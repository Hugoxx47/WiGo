import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OpenSeadragon from 'openseadragon'; 
// @ts-ignore
import domtoimage from 'dom-to-image'; 

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PolylineIcon from '@mui/icons-material/Polyline';
import PanToolIcon from '@mui/icons-material/PanTool';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import UndoIcon from '@mui/icons-material/Undo';
import CameraAltIcon from '@mui/icons-material/CameraAlt'; 
import DescriptionIcon from '@mui/icons-material/Description'; // Icon for form

type ToolType = 'move' | 'rect' | 'circle' | 'polygon' | 'text';

interface Shape {
  type: ToolType;
  x: number; y: number; 
  w?: number; h?: number; 
  radius?: number; 
  points?: {x: number, y: number}[]; 
  text?: string;
}

export default function Viewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  const rawUrl = searchParams.get('url'); 
  const patientName = location.state?.patientName || "Patient";
  const folderId = location.state?.folderId || "X-00";
  const defaultDziFilename = location.state?.image_url; 
  const extractionId = location.state?.extractionId; 
  const initialROI = location.state?.roi; 
  const isAnnotationMode = !!extractionId;

  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false); 
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  // --- ÉTATS DU FORMULAIRE MÉDICAL COMPLET (Basé sur vos images) ---
  // 1. Informations sur le prélèvement
  const [prelevementType, setPrelevementType] = useState("fine");
  const [prelevementDate, setPrelevementDate] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [fixation, setFixation] = useState("formol");
  const [slideCount, setSlideCount] = useState<number | ''>('');
  const [staining, setStaining] = useState<string[]>([]); // Multi-select logic needed or simple comma text

  // 2. Analyse Pathologique
  const [macroObs, setMacroObs] = useState("");
  const [microObs, setMicroObs] = useState("");
  const [histoType, setHistoType] = useState("canalaire");
  const [sbrGrade, setSbrGrade] = useState("1");
  const [margins, setMargins] = useState("");
  const [hormonalReceptors, setHormonalReceptors] = useState("");
  const [diagnosis, setDiagnosis] = useState("benin");
  const [comments, setComments] = useState("");

  // 3. Traçabilité
  const [status, setStatus] = useState("en_analyse");
  const [pathologist, setPathologist] = useState("");
  const [validationDate, setValidationDate] = useState("");
  // ------------------------------------

  const [currentTool, setCurrentTool] = useState<ToolType>('move');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tempShape, setTempShape] = useState<Shape | null>(null);
  
  const [polyPoints, setPolyPoints] = useState<{x: number, y: number}[]>([]);
  const [pendingTextPos, setPendingTextPos] = useState<{x: number, y: number} | null>(null);
  const [textValue, setTextValue] = useState("");

  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number, y: number } | null>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    if (!rawUrl) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    let finalTileSource = rawUrl.startsWith('http') ? rawUrl : `${baseUrl}/dzi_data/${rawUrl}`;

    if (viewerRef.current) viewerRef.current.destroy();

    try {
        viewerRef.current = OpenSeadragon({
            id: "openseadragon-viewer",
            prefixUrl: "https://openseadragon.github.io/openseadragon/images/", 
            tileSources: finalTileSource,
            showNavigator: true, 
            animationTime: 0.5,
            blendTime: 0.1,
            maxZoomPixelRatio: 10, 
            gestureSettingsMouse: { clickToZoom: false },
            crossOriginPolicy: "Anonymous",
            useCanvas: false, 
        });

        viewerRef.current.setMouseNavEnabled(true);

        if (initialROI && initialROI.w > 0) {
            viewerRef.current.addHandler('open', function() {
                if(!viewerRef.current) return;
                const rect = viewerRef.current.viewport.imageToViewportRectangle(
                    initialROI.x, initialROI.y, initialROI.w, initialROI.h
                );
                viewerRef.current.viewport.fitBounds(rect, true);
            });
        }
    } catch (e) { console.error("Erreur OSD:", e); }
    return () => { if (viewerRef.current) viewerRef.current.destroy(); };
  }, [rawUrl, initialROI]);

  useEffect(() => {
      if (viewerRef.current) {
          viewerRef.current.setMouseNavEnabled(currentTool === 'move');
      }
  }, [currentTool]);

  const getCoords = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (currentTool === 'move' || showSaveModal || pendingTextPos) return;
      const { x, y } = getCoords(e);
      if (currentTool === 'text') { setPendingTextPos({x, y}); setTextValue(""); return; }
      if (currentTool === 'polygon') { setPolyPoints(prev => [...prev, {x, y}]); return; }
      isDrawingRef.current = true;
      startPosRef.current = { x, y };
      if (currentTool === 'rect') setTempShape({ type: 'rect', x, y, w: 0, h: 0 });
      else if (currentTool === 'circle') setTempShape({ type: 'circle', x, y, radius: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!startPosRef.current && currentTool !== 'polygon') return;
      const { x, y } = getCoords(e);
      if (isDrawingRef.current && startPosRef.current) {
          const startX = startPosRef.current.x; const startY = startPosRef.current.y;
          if (currentTool === 'rect') { setTempShape({ type: 'rect', x: Math.min(x, startX), y: Math.min(y, startY), w: Math.abs(x - startX), h: Math.abs(y - startY) }); } 
          else if (currentTool === 'circle') { const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2)); setTempShape({ type: 'circle', x: startX, y: startY, radius }); }
      }
  };

  const handleMouseUp = () => { 
      if (currentTool === 'polygon') return;
      isDrawingRef.current = false;
      if (tempShape) {
          if (tempShape.type === 'rect' && (tempShape.w || 0) < 5) { setTempShape(null); return; }
          if (!isAnnotationMode) { setShapes([tempShape]); setCurrentTool('move'); } 
          else { setShapes(prev => [...prev, tempShape]); }
          setTempShape(null);
      }
  };
  
  const handleDoubleClick = () => {
      if (currentTool === 'polygon' && polyPoints.length > 2) {
          const newPoly: Shape = { type: 'polygon', x: 0, y: 0, points: polyPoints };
          if (!isAnnotationMode) setShapes([newPoly]); else setShapes(prev => [...prev, newPoly]);
          setPolyPoints([]); setTempShape(null); setCurrentTool('move');
      }
  };

  const confirmText = () => { if (pendingTextPos && textValue.trim() !== "") { const newText: Shape = { type: 'text', x: pendingTextPos.x, y: pendingTextPos.y, text: textValue }; setShapes(prev => [...prev, newText]); } setPendingTextPos(null); setCurrentTool('move'); };
  const handleUndo = () => setShapes(prev => prev.slice(0, -1));
  const handleClear = () => { setShapes([]); setTempShape(null); setPolyPoints([]); setPendingTextPos(null); setCurrentTool('move'); setShowSaveModal(false); };

  const handleDownloadSnapshot = () => {
      const node = containerRef.current;
      if (!node) return;
      domtoimage.toJpeg(node, { quality: 0.95 }).then((dataUrl: string) => { const link = document.createElement('a'); link.download = `annotation_${patientName}.jpg`; link.href = dataUrl; link.click(); }).catch((error: any) => { console.error('Erreur:', error); alert("Erreur capture."); });
  };

  const handleSaveAction = async () => {
      if (!viewerRef.current || shapes.length === 0) return;
      setLoading(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      let successCount = 0;

      try {
          for (const shape of shapes) {
            let boxX = 0, boxY = 0, boxW = 0, boxH = 0;
            if (shape.type === 'rect') { boxX = shape.x; boxY = shape.y; boxW = shape.w || 0; boxH = shape.h || 0; } 
            else if (shape.type === 'circle' && shape.radius) { boxX = shape.x - shape.radius; boxY = shape.y - shape.radius; boxW = shape.radius * 2; boxH = shape.radius * 2; } 
            else if (shape.type === 'polygon' && shape.points) { const xs = shape.points.map(p => p.x); const ys = shape.points.map(p => p.y); boxX = Math.min(...xs); boxY = Math.min(...ys); boxW = Math.max(...xs) - boxX; boxH = Math.max(...ys) - boxY; } 
            else if (shape.type === 'text') { boxX = shape.x; boxY = shape.y; }

            const p1 = viewerRef.current.viewport.viewerElementToImageCoordinates(new OpenSeadragon.Point(boxX, boxY));
            const p2 = viewerRef.current.viewport.viewerElementToImageCoordinates(new OpenSeadragon.Point(boxX + boxW, boxY + boxH));
            const finalX = Math.round(Math.min(p1.x, p2.x));
            const finalY = Math.round(Math.min(p1.y, p2.y));
            const finalW = Math.round(Math.abs(p2.x - p1.x));
            const finalH = Math.round(Math.abs(p2.y - p1.y));
            
            const finalLabel = shape.type === 'text' && shape.text ? shape.text : "Extraction";

            const payload = {
                filename: defaultDziFilename || "biopsie_cmu_1.dzi",
                x: finalX, y: finalY, width: finalW, height: finalH,
                patient_folder: folderId, patient_name: patientName, annotation_label: finalLabel,
                extraction_id: extractionId, w: finalW, h: finalH, label: finalLabel,
                
                // DONNÉES DU FORMULAIRE MÉDICAL (Pour le backend)
                prelevement_type: prelevementType,
                prelevement_date: prelevementDate,
                block_number: blockNumber,
                fixation: fixation,
                slide_count: slideCount,
                staining: staining, // Send as array or joined string
                macro_obs: macroObs,
                micro_obs: microObs,
                histo_type: histoType,
                sbr_grade: sbrGrade,
                margins: margins,
                hormonal_receptors: hormonalReceptors,
                diagnosis: diagnosis,
                comments: comments,
                status: status,
                pathologist: pathologist,
                validation_date: validationDate
            };

            const url = isAnnotationMode ? `${baseUrl}/annotations/save` : `${baseUrl}/extract-roi`;
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) successCount++;
          }

          if(successCount > 0) { alert(`✅ Dossier mis à jour et sauvegardé !`); handleClear(); } 
          else { alert("Erreur serveur"); }
      } catch (err) { alert("Erreur réseau"); } 
      finally { setLoading(false); setShowSaveModal(false); }
  };

  const handleStainingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions, option => option.value);
    setStaining(options);
  };

  useEffect(() => {
      // Si on a un extractionId (donc on vient du Dashboard pour voir un dossier existant)
      if (extractionId) {
          setLoading(true);
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          
          fetch(`${baseUrl}/extractions/${extractionId}/details`)
              .then(res => res.json())
              .then(data => {
                  // On remplit tous les champs du formulaire avec ce qui vient de la BDD
                  setLabelInput(data.filename || "");
                  setPrelevementType(data.prelevement_type || "fine");
                  setPrelevementDate(data.prelevement_date || "");
                  setBlockNumber(data.block_number || "");
                  setFixation(data.fixation || "formol");
                  setSlideCount(data.slide_count || "");
                  setStaining(data.staining || []);
                  setMacroObs(data.macro_obs || "");
                  setMicroObs(data.micro_obs || "");
                  setHistoType(data.histo_type || "canalaire");
                  setSbrGrade(data.sbr_grade || "1");
                  setMargins(data.margins || "");
                  setHormonalReceptors(data.hormonal_receptors || "");
                  setDiagnosis(data.diagnosis || "benin");
                  setComments(data.comments || "");
                  setStatus(data.status || "en_analyse");
                  setPathologist(data.pathologist || "");
                  setValidationDate(data.validation_date || "");
                  
                  setIsReadOnly(true);
              })
              .catch(err => console.error("Erreur chargement dossier:", err))
              .finally(() => setLoading(false));
      }
  }, [extractionId]);

  return (
    <div ref={containerRef} className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white select-none">
      <div id="openseadragon-viewer" className="absolute inset-0 z-0 bg-black" />

      {/* ZONE DESSIN (SVG) */}
      <div className={`absolute inset-0 z-10 ${currentTool === 'move' && !pendingTextPos ? 'pointer-events-none' : 'cursor-crosshair pointer-events-auto'}`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onDoubleClick={handleDoubleClick}>
        <svg className="w-full h-full pointer-events-none">
            {currentTool === 'rect' && tempShape && <rect x={tempShape.x} y={tempShape.y} width={tempShape.w} height={tempShape.h} fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2" />}
            {currentTool === 'circle' && tempShape && <circle cx={tempShape.x} cy={tempShape.y} r={tempShape.radius} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />}
            {currentTool === 'polygon' && <polyline points={polyPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="2" />}
            {shapes.map((shape, idx) => (
                <g key={idx}>
                    {shape.type === 'rect' && <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="rgba(16, 185, 129, 0.4)" stroke="#10b981" strokeWidth="3" />}
                    {shape.type === 'circle' && <circle cx={shape.x} cy={shape.y} r={shape.radius} fill="rgba(59, 130, 246, 0.4)" stroke="#3b82f6" strokeWidth="3" />}
                    {shape.type === 'polygon' && shape.points && <polygon points={shape.points.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(245, 158, 11, 0.4)" stroke="#f59e0b" strokeWidth="3" />}
                    {shape.type === 'text' && <text x={shape.x} y={shape.y} fill="#facc15" fontSize="24" fontWeight="bold" textAnchor="middle" style={{ textShadow: '2px 2px 4px black' }}>{shape.text}</text>}
                </g>
            ))}
        </svg>
        {pendingTextPos && (
            <div className="absolute bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-600 flex gap-2 pointer-events-auto" style={{ left: pendingTextPos.x, top: pendingTextPos.y }}>
                <input autoFocus type="text" value={textValue} onChange={(e) => setTextValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmText()} placeholder="Texte..." className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-1 outline-none" />
                <button onClick={confirmText} className="bg-emerald-600 text-white px-2 rounded">OK</button>
            </div>
        )}
      </div>

      {/* HEADER & OUTILS */}
      <div className="absolute top-0 left-0 w-full p-4 z-20 pointer-events-none flex justify-between items-start" data-html2canvas-ignore="true">
         <div className="pointer-events-auto bg-slate-900/90 border border-slate-700 rounded-xl p-2 flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowBackIcon /></button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">{patientName}</h1>
                <div className="text-xs text-slate-400">ID: {folderId}</div>
            </div>
         </div>
         <div className="pointer-events-auto bg-slate-800 border border-slate-600 rounded-xl p-1 flex gap-1 shadow-2xl">
            <button onClick={() => setCurrentTool('move')} className={`p-3 rounded-lg ${currentTool === 'move' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}><PanToolIcon /></button>
            <div className="w-px bg-slate-600 mx-1"></div>
            <button onClick={() => {setCurrentTool('rect'); setTempShape(null)}} className={`p-3 rounded-lg ${currentTool === 'rect' ? 'bg-emerald-600 text-white' : 'text-emerald-400'}`}><CropSquareIcon /></button>
            {isAnnotationMode && (
                <>
                    <button onClick={() => {setCurrentTool('circle'); setTempShape(null)}} className={`p-3 rounded-lg ${currentTool === 'circle' ? 'bg-blue-600 text-white' : 'text-blue-400'}`}><RadioButtonUncheckedIcon /></button>
                    <button onClick={() => {setCurrentTool('polygon'); setTempShape(null); setPolyPoints([])}} className={`p-3 rounded-lg ${currentTool === 'polygon' ? 'bg-amber-600 text-white' : 'text-amber-400'}`}><PolylineIcon /></button>
                    <button onClick={() => {setCurrentTool('text'); setTempShape(null); setPendingTextPos(null)}} className={`p-3 rounded-lg ${currentTool === 'text' ? 'bg-yellow-600 text-white' : 'text-yellow-400'}`}><TextFieldsIcon /></button>
                </>
            )}
         </div>

         <div className="pointer-events-auto flex gap-2">
             <button onClick={handleDownloadSnapshot} className="p-3 bg-indigo-600 text-white border border-indigo-500 rounded-xl hover:bg-indigo-500 shadow-lg" title="JPEG"><CameraAltIcon /></button>
            {shapes.length > 0 && <button onClick={handleUndo} className="p-3 bg-slate-700 text-white border border-slate-500 rounded-xl hover:bg-slate-600"><UndoIcon /></button>}
            {(shapes.length > 0 || polyPoints.length > 0) && <button onClick={handleClear} className="p-3 bg-red-500/20 text-red-400 border border-red-500 rounded-xl"><DeleteForeverIcon /></button>}
            {shapes.length > 0 && currentTool === 'move' && (
                <button onClick={() => setShowSaveModal(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105"><DescriptionIcon /> Formulaire</button>
            )}
         </div>
      </div>

      {/* --- FORMULAIRE COMPLET (SCROLLABLE MODAL) --- */}
      {showSaveModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-4 overflow-hidden">
              <div className="bg-slate-900 border border-slate-600 rounded-2xl w-[900px] h-[90%] shadow-2xl flex flex-col">
                  {/* Modal Header */}
                  <div className="flex items-center gap-4 p-6 border-b border-slate-700 bg-slate-800 rounded-t-2xl">
                      <div className="bg-emerald-500 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">{patientName.charAt(0)}</div>
                      <div>
                          <h2 className="text-2xl font-bold text-white">Formulaire de Biopsie Mammaire</h2>
                          <div className="text-sm text-slate-400">Patient: {patientName} (ID: {folderId})</div>
                      </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                      
                      {/* SECTION 1: Informations sur le prélèvement */}
                      <section className="space-y-4">
                          <h3 className="text-lg font-bold text-emerald-400 border-b border-slate-700 pb-2">1. Informations sur le prélèvement</h3>
                          <div className="grid grid-cols-2 gap-6">
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Type de prélèvement</label>
                                  <select value={prelevementType} onChange={(e) => setPrelevementType(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500">
                                      <option value="fine">Aiguille fine</option>
                                      <option value="core">Core biopsy</option>
                                      <option value="exerese">Exérèse</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Date du prélèvement</label>
                                  <input type="date" value={prelevementDate} onChange={(e) => setPrelevementDate(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500" />
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Numéro du bloc</label>
                                  <input type="text" value={blockNumber} onChange={(e) => setBlockNumber(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500" placeholder="Ex: B-2023-123" />
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Fixation</label>
                                  <select value={fixation} onChange={(e) => setFixation(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500">
                                      <option value="formol">Formol</option>
                                      <option value="autre">Autre</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Nombre de lames</label>
                                  <input type="number" value={slideCount} onChange={(e) => setSlideCount(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500" />
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Coloration (Multiple)</label>
                                  <select multiple value={staining} onChange={handleStainingChange} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500 h-24">
                                      <option value="HE">H&E</option>
                                      <option value="IHC">IHC</option>
                                      <option value="HER2">HER2</option>
                                      <option value="ER">ER</option>
                                      <option value="PR">PR</option>
                                  </select>
                                  <div className="text-[10px] text-slate-500 mt-1">Ctrl+Click pour sélection multiple</div>
                              </div>
                          </div>
                      </section>

                      {/* SECTION 2: Analyse Pathologique */}
                      <section className="space-y-4">
                          <h3 className="text-lg font-bold text-blue-400 border-b border-slate-700 pb-2">2. Analyse Pathologique</h3>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Observations Macroscopiques</label>
                                  <textarea rows={2} value={macroObs} onChange={(e) => setMacroObs(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500" placeholder="Taille, forme, texture..."></textarea>
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Observations Microscopiques</label>
                                  <textarea rows={2} value={microObs} onChange={(e) => setMicroObs(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500" placeholder="Morphologie des cellules..."></textarea>
                              </div>
                              <div className="grid grid-cols-2 gap-6">
                                  <div>
                                      <label className="block text-xs text-slate-400 mb-1">Type Histologique</label>
                                      <select value={histoType} onChange={(e) => setHistoType(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500">
                                          <option value="canalaire">Carcinome Canalaire</option>
                                          <option value="lobulaire">Carcinome Lobulaire</option>
                                          <option value="autre">Autre</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs text-slate-400 mb-1">Grade SBR</label>
                                      <select value={sbrGrade} onChange={(e) => setSbrGrade(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500">
                                          <option value="1">1</option>
                                          <option value="2">2</option>
                                          <option value="3">3</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs text-slate-400 mb-1">Marges chirurgicales</label>
                                      <input type="text" value={margins} onChange={(e) => setMargins(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500" placeholder="Saines / Envahies" />
                                  </div>
                                  <div>
                                      <label className="block text-xs text-slate-400 mb-1">Récepteurs Hormonaux</label>
                                      <input type="text" value={hormonalReceptors} onChange={(e) => setHormonalReceptors(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500" placeholder="ER+, PR+, HER2..." />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Diagnostic Final</label>
                                  <select value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500 font-bold">
                                      <option value="benin">Bénin</option>
                                      <option value="malin">Malin</option>
                                      <option value="cis">Carcinome in situ (CIS)</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Commentaires</label>
                                  <textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500"></textarea>
                              </div>
                          </div>
                      </section>

                      {/* SECTION 3: Traçabilité */}
                      <section className="space-y-4">
                          <h3 className="text-lg font-bold text-purple-400 border-b border-slate-700 pb-2">3. Traçabilité et Suivi</h3>
                          <div className="grid grid-cols-2 gap-6">
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Statut</label>
                                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-purple-500">
                                      <option value="en_analyse">En analyse</option>
                                      <option value="termine">Terminé</option>
                                      <option value="archive">Archivé</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Pathologiste Responsable</label>
                                  <input type="text" value={pathologist} onChange={(e) => setPathologist(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-purple-500" placeholder="Dr..." />
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Date de validation</label>
                                  <input type="date" value={validationDate} onChange={(e) => setValidationDate(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-purple-500" />
                              </div>
                          </div>
                      </section>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 border-t border-slate-700 bg-slate-800 rounded-b-2xl flex gap-3">
                      <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition font-medium">Annuler</button>
                      <button onClick={handleSaveAction} disabled={loading} className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition shadow-lg flex justify-center items-center gap-2">
                          {loading ? "Enregistrement..." : <><CheckCircleIcon /> Valider le formulaire</>}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}