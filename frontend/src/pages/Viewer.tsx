import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OpenSeadragon from 'openseadragon'; 
// @ts-ignore
import domtoimage from 'dom-to-image'; 

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PanToolIcon from '@mui/icons-material/PanTool';
import UndoIcon from '@mui/icons-material/Undo';
import CameraAltIcon from '@mui/icons-material/CameraAlt'; 
import DescriptionIcon from '@mui/icons-material/Description';

type ToolType = 'move' | 'rect' | 'circle';

// On stocke toujours les formes en COORDONNÉES IMAGE (fixes)
interface Shape {
  type: ToolType;
  x: number; y: number; // Image coordinates
  w: number; h: number; // Image coordinates
  radius?: number; 
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
  const [redrawToken, setRedrawToken] = useState(0); // Pour forcer le redessin quand on zoom

  // --- FORMULAIRE ---
  const [prelevementType, setPrelevementType] = useState("fine");
  const [prelevementDate, setPrelevementDate] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [fixation, setFixation] = useState("formol");
  const [slideCount, setSlideCount] = useState<number | ''>('');
  const [staining, setStaining] = useState<string[]>([]);
  const [macroObs, setMacroObs] = useState("");
  const [microObs, setMicroObs] = useState("");
  const [histoType, setHistoType] = useState("canalaire");
  const [sbrGrade, setSbrGrade] = useState("1");
  const [margins, setMargins] = useState("");
  const [hormonalReceptors, setHormonalReceptors] = useState("");
  const [diagnosis, setDiagnosis] = useState("benin");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("en_analyse");
  const [pathologist, setPathologist] = useState("");
  const [validationDate, setValidationDate] = useState("");
  const [labelInput, setLabelInput] = useState("Extraction");

  // --- OUTILS ---
  const [currentTool, setCurrentTool] = useState<ToolType>('move');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [currentDragShape, setCurrentDragShape] = useState<Shape | null>(null); // Forme en cours de dessin

  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null); 

  // --- 1. INITIALISATION OSD ---
  useEffect(() => {
    if (!rawUrl) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    let finalTileSource = rawUrl.startsWith('http') ? rawUrl : `${baseUrl}/dzi_data/${rawUrl}`;

    if (viewerRef.current) viewerRef.current.destroy();

    try {
        const viewer = OpenSeadragon({
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

        viewerRef.current = viewer;

        // Force le redessin React lors du zoom/panoramique pour que les rectangles suivent
        const updateOverlay = () => setRedrawToken(n => n + 1);
        viewer.addHandler('animation', updateOverlay);
        viewer.addHandler('update-viewport', updateOverlay);
        viewer.addHandler('resize', updateOverlay);

        viewer.setMouseNavEnabled(true);

        if (initialROI && initialROI.w > 0) {
            viewer.addHandler('open', function() {
                const rect = viewer.viewport.imageToViewportRectangle(
                    initialROI.x, initialROI.y, initialROI.w, initialROI.h
                );
                viewer.viewport.fitBounds(rect, true);
            });
        }
    } catch (e) { console.error("Erreur OSD:", e); }
    return () => { if (viewerRef.current) viewerRef.current.destroy(); };
  }, [rawUrl]);

  // Bloquer le mouvement OSD si on dessine
  useEffect(() => {
      if (viewerRef.current) {
          viewerRef.current.setMouseNavEnabled(currentTool === 'move');
      }
  }, [currentTool]);

  // --- FONCTION MANQUANTE AJOUTÉE ---
  const handleDownloadSnapshot = () => {
      const node = containerRef.current;
      if (!node) return;
      domtoimage.toJpeg(node, { quality: 0.95 })
          .then((dataUrl: string) => {
              const link = document.createElement('a');
              link.download = `annotation_${patientName}.jpg`;
              link.href = dataUrl;
              link.click();
          })
          .catch((error: any) => {
              console.error('Erreur:', error);
              alert("Erreur capture.");
          });
  };

  // --- 2. GESTION DU DESSIN ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if (currentTool === 'move' || !viewerRef.current) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDragStart({x, y});
      setCurrentDragShape({ type: currentTool, x, y, w: 0, h: 0 }); 
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragStart || !currentDragShape) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const w = Math.abs(currentX - dragStart.x);
      const h = Math.abs(currentY - dragStart.y);
      const x = Math.min(currentX, dragStart.x);
      const y = Math.min(currentY, dragStart.y);

      let radius = 0;
      if (currentTool === 'circle') {
          radius = Math.sqrt(Math.pow(currentX - dragStart.x, 2) + Math.pow(currentY - dragStart.y, 2));
      }

      setCurrentDragShape({ ...currentDragShape, x, y, w, h, radius });
  };

  const handleMouseUp = () => {
      if (!currentDragShape || !viewerRef.current) {
          setDragStart(null);
          setCurrentDragShape(null);
          return;
      }

      // Conversion Écran -> Image (pour sauvegarder la position réelle)
      const p1 = viewerRef.current.viewport.viewerElementToImageCoordinates(
          new OpenSeadragon.Point(currentDragShape.x, currentDragShape.y)
      );
      const p2 = viewerRef.current.viewport.viewerElementToImageCoordinates(
          new OpenSeadragon.Point(currentDragShape.x + currentDragShape.w, currentDragShape.y + currentDragShape.h)
      );

      const imageX = p1.x;
      const imageY = p1.y;
      const imageW = p2.x - p1.x;
      const imageH = p2.y - p1.y;
      
      const pRadius = viewerRef.current.viewport.deltaPointsFromPixels(
          new OpenSeadragon.Point(currentDragShape.radius || 0, 0)
      );
      const imageRadius = pRadius.x; 

      const newShape: Shape = {
          type: currentTool,
          x: imageX,
          y: imageY,
          w: imageW,
          h: imageH,
          radius: imageRadius
      };

      if (newShape.w > 10 || (newShape.radius && newShape.radius > 10)) {
          if (!isAnnotationMode) setShapes([newShape]); 
          else setShapes(prev => [...prev, newShape]); 
          setCurrentTool('move');
          if (!isAnnotationMode) setShowSaveModal(true); 
      }

      setDragStart(null);
      setCurrentDragShape(null);
  };

  // --- 3. RENDU DES FORMES (Image -> Écran) ---
  const renderShapes = () => {
      if (!viewerRef.current) return null;

      return shapes.map((shape, idx) => {
          // Recalculer la position écran à chaque render (zoom/pan)
          const p1 = viewerRef.current!.viewport.imageToViewerElementCoordinates(
              new OpenSeadragon.Point(shape.x, shape.y)
          );
          const p2 = viewerRef.current!.viewport.imageToViewerElementCoordinates(
              new OpenSeadragon.Point(shape.x + shape.w, shape.y + shape.h)
          );

          const screenX = p1.x;
          const screenY = p1.y;
          const screenW = p2.x - p1.x;
          const screenH = p2.y - p1.y;

          if (shape.type === 'rect') {
              return <rect key={idx} x={screenX} y={screenY} width={screenW} height={screenH} fill="rgba(16, 185, 129, 0.3)" stroke="#10b981" strokeWidth="3" />;
          }
          if (shape.type === 'circle') {
              const pRadius = viewerRef.current!.viewport.deltaPixelsFromPoints(
                  new OpenSeadragon.Point(shape.radius || 0, 0)
              );
              return <circle key={idx} cx={screenX} cy={screenY} r={pRadius.x} fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" strokeWidth="3" />;
          }
          return null;
      });
  };

  // --- CHARGEMENT DONNÉES ---
  useEffect(() => {
      if (extractionId) {
          setLoading(true);
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          fetch(`${baseUrl}/extractions/${extractionId}/details`)
              .then(res => res.json())
              .then(data => {
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

  // --- SAUVEGARDE ---
  const handleSaveAction = async () => {
      if (!shapes.length) return;
      setLoading(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const shape = shapes[0]; 
      
      const payload = {
          filename: defaultDziFilename || "biopsie_cmu_1.dzi",
          x: Math.round(shape.x), 
          y: Math.round(shape.y), 
          width: Math.round(shape.w), 
          height: Math.round(shape.h),
          patient_folder: folderId, 
          patient_name: patientName, 
          annotation_label: labelInput,
          extraction_id: extractionId,
          
          prelevement_type: prelevementType,
          prelevement_date: prelevementDate,
          block_number: blockNumber,
          fixation: fixation,
          slide_count: slideCount,
          staining: staining,
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

      try {
          const url = isAnnotationMode ? `${baseUrl}/annotations/save` : `${baseUrl}/extract-roi`;
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if(res.ok) { 
              alert("✅ Sauvegardé !"); 
              setShowSaveModal(false);
              setShapes([]); 
              navigate('/dashboard'); 
          } else {
              alert("Erreur serveur");
          }
      } catch (err) { alert("Erreur réseau"); } 
      finally { setLoading(false); }
  };

  const handleStainingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions, option => option.value);
    setStaining(options);
  };

  return (
    <div ref={containerRef} className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white select-none">
      
      {/* 1. OPENSEADRAGON */}
      <div id="openseadragon-viewer" className="absolute inset-0 z-0 bg-black" />

      {/* 2. COUCHE SVG (z-10) */}
      <div className={`absolute inset-0 z-10 ${currentTool !== 'move' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        <svg className="w-full h-full">
            {renderShapes()}
            {currentDragShape && currentTool === 'rect' && (
                <rect x={currentDragShape.x} y={currentDragShape.y} width={currentDragShape.w} height={currentDragShape.h} fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="2" />
            )}
            {currentDragShape && currentTool === 'circle' && (
                <circle cx={currentDragShape.x} cy={currentDragShape.y} r={currentDragShape.radius} fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="2" />
            )}
        </svg>
      </div>

      {/* 3. HEADER & OUTILS (z-20) */}
      <div className="absolute top-0 left-0 w-full p-4 z-20 pointer-events-none flex justify-between items-start">
         <div className="pointer-events-auto bg-slate-900/90 border border-slate-700 rounded-xl p-2 flex items-center gap-4 shadow-xl">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg"><ArrowBackIcon /></button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">{patientName}</h1>
                <div className="text-xs text-slate-400">ID: {folderId}</div>
            </div>
         </div>

         <div className="pointer-events-auto bg-slate-800 border border-slate-600 rounded-xl p-1 flex gap-1 shadow-2xl">
            <button onClick={() => setCurrentTool('move')} className={`p-3 rounded-lg transition ${currentTool === 'move' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Déplacer"><PanToolIcon /></button>
            <div className="w-px bg-slate-600 mx-1"></div>
            <button onClick={() => setCurrentTool('rect')} className={`p-3 rounded-lg transition ${currentTool === 'rect' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-white'}`} title="Rectangle"><CropSquareIcon /></button>
            {isAnnotationMode && (
                <button onClick={() => setCurrentTool('circle')} className={`p-3 rounded-lg transition ${currentTool === 'circle' ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-white'}`} title="Cercle"><RadioButtonUncheckedIcon /></button>
            )}
         </div>

         <div className="pointer-events-auto flex gap-2">
             <button onClick={handleDownloadSnapshot} className="p-3 bg-indigo-600 text-white border border-indigo-500 rounded-xl hover:bg-indigo-500 shadow-lg" title="Capture d'écran"><CameraAltIcon /></button>
            {shapes.length > 0 && <button onClick={() => setShapes([])} className="p-3 bg-red-500/20 text-red-400 border border-red-500 rounded-xl hover:bg-red-500/40"><DeleteForeverIcon /></button>}
            
            {(extractionId || shapes.length > 0) && (
                <button onClick={() => setShowSaveModal(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105 hover:bg-emerald-500 transition">
                    <DescriptionIcon /> Formulaire
                </button>
            )}
         </div>
      </div>

      {/* --- FORMULAIRE MODAL --- */}
      {showSaveModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-4 overflow-hidden">
              <div className="bg-slate-900 border border-slate-600 rounded-2xl w-[900px] h-[90%] shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center gap-4 p-6 border-b border-slate-700 bg-slate-800 rounded-t-2xl">
                      <div className="bg-emerald-500 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl">{patientName.charAt(0)}</div>
                      <div>
                          <h2 className="text-2xl font-bold text-white">Dossier Médical & Analyse</h2>
                          <div className="text-sm text-slate-400">Patient: {patientName} (ID: {folderId})</div>
                      </div>
                      <button onClick={() => setShowSaveModal(false)} className="ml-auto text-slate-400 hover:text-white">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                      {/* Section 1 : Prélèvement */}
                      <section className="space-y-4">
                          <h3 className="text-lg font-bold text-emerald-400 border-b border-slate-700 pb-2">1. Informations Prélèvement</h3>
                          <div className="grid grid-cols-2 gap-6">
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Nom de l'extraction (Label)</label>
                                  <input type="text" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white font-bold text-emerald-300" />
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Type</label>
                                  <select value={prelevementType} onChange={(e) => setPrelevementType(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white">
                                      <option value="fine">Aiguille fine</option>
                                      <option value="core">Core biopsy</option>
                                      <option value="exerese">Exérèse</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                                  <input type="date" value={prelevementDate} onChange={(e) => setPrelevementDate(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" />
                              </div>
                              <div>
                                  <label className="block text-xs text-slate-400 mb-1">N° Bloc</label>
                                  <input type="text" value={blockNumber} onChange={(e) => setBlockNumber(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" />
                              </div>
                          </div>
                      </section>

                      {/* Section 2 : Analyse */}
                      <section className="space-y-4">
                          <h3 className="text-lg font-bold text-blue-400 border-b border-slate-700 pb-2">2. Analyse Pathologique</h3>
                          <div>
                              <label className="block text-xs text-slate-400 mb-1">Diagnostic Final</label>
                              <select value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white font-bold">
                                  <option value="benin">Bénin</option>
                                  <option value="malin">Malin</option>
                                  <option value="cis">Carcinome in situ (CIS)</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs text-slate-400 mb-1">Commentaires</label>
                              <textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"></textarea>
                          </div>
                      </section>
                  </div>

                  <div className="p-6 border-t border-slate-700 bg-slate-800 rounded-b-2xl flex gap-3">
                      <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600">Retour</button>
                      <button onClick={handleSaveAction} disabled={loading} className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-lg flex justify-center items-center gap-2">
                          {loading ? "Sauvegarde..." : <><CheckCircleIcon /> Enregistrer le dossier</>}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}