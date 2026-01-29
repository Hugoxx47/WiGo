import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OpenSeadragon from 'openseadragon'; 
// @ts-ignore
import domtoimage from 'dom-to-image'; 

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PolylineIcon from '@mui/icons-material/Polyline';
import PanToolIcon from '@mui/icons-material/PanTool';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import UndoIcon from '@mui/icons-material/Undo';
import CameraAltIcon from '@mui/icons-material/CameraAlt'; 

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
  
  // --- ETATS DU FORMULAIRE MÉDICAL ---
  const [labelInput, setLabelInput] = useState("Extraction"); // Nom du fichier
  const [birthDate, setBirthDate] = useState(location.state?.birthDate || "");
  const [familyHistory, setFamilyHistory] = useState(location.state?.familyHistory || "Non");
  const [medicalHistory, setMedicalHistory] = useState(location.state?.medicalHistory || "");
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

  const confirmText = () => { if (pendingTextPos && textValue.trim() !== "") { const newText: Shape = { type: 'text', x: pendingTextPos.x, y: pendingTextPos.y, text: textValue }; setShapes(prev => [...prev, newText]); setLabelInput(textValue); } setPendingTextPos(null); setCurrentTool('move'); };
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
            
            const finalLabel = shape.type === 'text' && shape.text ? shape.text : labelInput;

            const payload = {
                filename: defaultDziFilename || "biopsie_cmu_1.dzi",
                x: finalX, y: finalY, width: finalW, height: finalH,
                patient_folder: folderId, patient_name: patientName, annotation_label: finalLabel,
                extraction_id: extractionId, w: finalW, h: finalH, label: finalLabel,
                
                // NOUVELLES DONNÉES ENVOYÉES AU BACKEND
                birth_date: birthDate,
                family_history: familyHistory,
                medical_history: medicalHistory
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

  return (
    <div ref={containerRef} className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white select-none">
      <div id="openseadragon-viewer" className="absolute inset-0 z-0 bg-black" />

      {/* ZONE DESSIN (SVG) - Inchangée */}
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

      {/* HEADER & OUTILS - Inchangés */}
      <div className="absolute top-0 left-0 w-full p-4 z-20 pointer-events-none flex justify-between items-start" data-html2canvas-ignore="true">
         <div className="pointer-events-auto bg-slate-900/90 border border-slate-700 rounded-xl p-2 flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowBackIcon /></button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">{patientName}</h1>
                <div className="text-xs text-slate-400">ID: {folderId}</div>
            </div>
         </div>
         {/* ... (Barre d'outils inchangée) ... */}
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
                <button onClick={() => setShowSaveModal(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105"><CheckCircleIcon /> Sauvegarder</button>
            )}
         </div>
      </div>

      {/* --- NOUVEAU MODAL TYPE "DOSSIER PATIENT" --- */}
      {showSaveModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto">
              <div className="bg-slate-900 border border-slate-600 p-6 rounded-2xl w-[500px] shadow-2xl">
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
                      <div className="bg-blue-500 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">{patientName.charAt(0)}</div>
                      <div>
                          <h2 className="text-xl font-bold text-white">Dossier Médical</h2>
                          <div className="text-sm text-slate-400">ID: {folderId}</div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      {/* LIGNE 1 : Nom et Date de naissance */}
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-xs text-slate-400 mb-1">Nom / Prénom</label>
                              <input type="text" value={patientName} disabled className="w-full bg-slate-800/50 border border-slate-700 rounded p-2 text-slate-300 cursor-not-allowed" />
                          </div>
                          <div className="flex-1">
                              <label className="block text-xs text-slate-400 mb-1">Date de naissance</label>
                              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none" />
                          </div>
                      </div>

                      {/* LIGNE 2 : Antécédents familiaux */}
                      <div>
                          <label className="block text-xs text-slate-400 mb-1">Antécédents familiaux de cancer du sein</label>
                          <select value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none">
                              <option value="Non">Non</option>
                              <option value="Oui">Oui</option>
                              <option value="Inconnu">Inconnu</option>
                          </select>
                      </div>

                      {/* LIGNE 3 : Antécédents médicaux */}
                      <div>
                          <label className="block text-xs text-slate-400 mb-1">Antécédents médicaux</label>
                          <textarea rows={3} value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none resize-none" placeholder="Ex: Hypertension, Diabète..."></textarea>
                      </div>

                      {/* LIGNE 4 : Nom de l'extraction (si extraction) */}
                      {!isAnnotationMode && (
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Label de l'extraction</label>
                            <input type="text" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none" />
                        </div>
                      )}
                  </div>

                  <div className="flex gap-3 mt-8">
                      <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition">Annuler</button>
                      <button onClick={handleSaveAction} disabled={loading} className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition shadow-lg">
                          {loading ? "Enregistrement..." : "Valider le dossier"}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}