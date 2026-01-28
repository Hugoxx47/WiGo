import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OpenSeadragon from 'openseadragon'; 
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CropFreeIcon from '@mui/icons-material/CropFree'; 
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveAsIcon from '@mui/icons-material/SaveAs';

export default function Viewer() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const patientName = location.state?.patientName || "Patient";
  const folderId = location.state?.folderId || "X-00";
  const dziFilename = location.state?.image_url || "biopsie_cmu_1.dzi"; 

  const [loading, setLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false); // Pour la popup de nommage
  const [annotationLabel, setAnnotationLabel] = useState("Zone suspecte"); // Nom par défaut

  // --- Dessin HTML ---
  const [drawBox, setDrawBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number, y: number } | null>(null);

  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);

  // --- 1. INITIALISATION VIEWER ---
  useEffect(() => {
    const tileSource = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/dzi/${dziFilename}`;

    if (viewerRef.current) viewerRef.current.destroy();

    try {
        viewerRef.current = OpenSeadragon({
            id: "openseadragon-viewer",
            prefixUrl: "https://openseadragon.github.io/openseadragon/images/", 
            tileSources: tileSource,
            showNavigator: true, 
            animationTime: 0.5,
            blendTime: 0.1,
            constrainDuringPan: true,
            maxZoomPixelRatio: 10, 
            minZoomLevel: 0.5,
            defaultZoomLevel: 0,
            visibilityRatio: 1,
            zoomInButton: "zoom-in",
            zoomOutButton: "zoom-out",
            homeButton: "home",
            fullPageButton: "full-page",
            gestureSettingsMouse: { clickToZoom: false } 
        });
    } catch (e) {
        console.error("Erreur OSD:", e);
    }

    return () => {
        if (viewerRef.current) viewerRef.current.destroy();
    };
  }, [dziFilename]);

  // --- 2. GESTION DU DESSIN (HTML) ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if (!isSelectionMode || hasSelection) return;
      const rect = e.currentTarget.getBoundingClientRect();
      isDrawingRef.current = true;
      startPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setDrawBox({ x: startPosRef.current.x, y: startPosRef.current.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDrawingRef.current || !startPosRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const newW = currentX - startPosRef.current.x;
      const newH = currentY - startPosRef.current.y;
      setDrawBox({
          x: newW < 0 ? currentX : startPosRef.current.x,
          y: newH < 0 ? currentY : startPosRef.current.y,
          w: Math.abs(newW),
          h: Math.abs(newH)
      });
  };

  const handleMouseUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      if (drawBox && drawBox.w > 5 && drawBox.h > 5) {
          setHasSelection(true);
      } else {
          setDrawBox(null);
      }
  };

  // --- 3. ANNULATION ---
  const handleClearSelection = () => {
      setHasSelection(false);
      setDrawBox(null);
      setIsSelectionMode(false);
      setShowSaveModal(false);
  };

  // --- 4. EXTRACTION PRO ---
  const handleExtractZone = async () => {
      if (!viewerRef.current || !drawBox) return;

      const p1 = viewerRef.current.viewport.viewerElementToImageCoordinates(new OpenSeadragon.Point(drawBox.x, drawBox.y));
      const p2 = viewerRef.current.viewport.viewerElementToImageCoordinates(new OpenSeadragon.Point(drawBox.x + drawBox.w, drawBox.y + drawBox.h));

      const x = Math.round(Math.min(p1.x, p2.x));
      const y = Math.round(Math.min(p1.y, p2.y));
      const width = Math.round(Math.abs(p2.x - p1.x));
      const height = Math.round(Math.abs(p2.y - p1.y));

      setLoading(true);
      try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/extract-roi`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  filename: dziFilename,
                  x, y, width, height,
                  patient_folder: folderId,
                  patient_name: patientName,
                  annotation_label: annotationLabel // Le nom choisi par l'utilisateur
              })
          });
          
          if(res.ok) {
              const data = await res.json();
              alert(`✅ SUCCÈS !\nFichier créé : ${data.filename}\nEmplacement : ${data.file}`);
              handleClearSelection();
          } else {
              const err = await res.json();
              alert(`Erreur : ${err.detail}`);
          }
      } catch (err) {
          console.error(err);
          alert("Erreur réseau");
      } finally {
          setLoading(false);
          setShowSaveModal(false);
      }
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      <div id="openseadragon-viewer" className="absolute inset-0 z-0 bg-black" style={{width: '100%', height: '100%'}} />

      {isSelectionMode && !hasSelection && (
          <div className="absolute inset-0 z-10 cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
              {drawBox && <div style={{position: 'absolute', left: drawBox.x, top: drawBox.y, width: drawBox.w, height: drawBox.h, border: '3px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', pointerEvents: 'none'}} />}
          </div>
      )}

      {hasSelection && drawBox && (
          <div className="absolute inset-0 z-10 pointer-events-none">
              <div style={{position: 'absolute', left: drawBox.x, top: drawBox.y, width: drawBox.w, height: drawBox.h, border: '3px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)'}} />
          </div>
      )}

      {/* HEADER */}
      <div className="absolute top-0 left-0 w-full p-4 z-20 flex justify-between pointer-events-none">
         <div className="pointer-events-auto bg-slate-900/90 border border-slate-700 rounded-xl p-2 flex items-center gap-4 shadow-2xl backdrop-blur-md">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ArrowBackIcon /></button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">{patientName}</h1>
                <p className="text-xs text-slate-400">#{folderId}</p>
            </div>
            <div className="flex gap-2 ml-2">
                <button id="zoom-in" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold">+</button>
                <button id="zoom-out" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold">-</button>
                <button id="home" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold">⟲</button>
            </div>
         </div>

         <div className="pointer-events-auto flex gap-3">
            {!hasSelection ? (
                <button onClick={() => {setIsSelectionMode(!isSelectionMode); setDrawBox(null);}} className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${isSelectionMode ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-slate-700 hover:bg-slate-600 text-white"}`}>
                    <CropFreeIcon /> {isSelectionMode ? "Annuler le dessin" : "Définir une zone"}
                </button>
            ) : (
                <>
                    <button onClick={handleClearSelection} className="px-4 py-2 bg-slate-800 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center gap-2">
                        <DeleteForeverIcon /> Annuler
                    </button>
                    <button onClick={() => setShowSaveModal(true)} className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all bg-gradient-to-r from-emerald-500 to-green-600 hover:scale-105 text-white">
                        <CheckCircleIcon /> Valider
                    </button>
                </>
            )}
         </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
          <p className="text-xs text-slate-400 bg-black/80 p-2 rounded border border-slate-800">
              {isSelectionMode ? "🖱️ Cliquez et glissez pour dessiner la zone." : hasSelection ? "✅ Zone sélectionnée. Validez pour enregistrer." : "Mode Navigation : Zoomez et déplacez-vous."}
          </p>
      </div>

      {/* --- POPUP DE VALIDATION PRO --- */}
      {showSaveModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-96 text-center">
                  <div className="bg-emerald-500/20 text-emerald-400 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                      <SaveAsIcon />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Extraction de Zone</h2>
                  <p className="text-sm text-slate-400 mb-6">Donnez un nom à cette zone pour l'ajouter au dossier patient.</p>
                  
                  <div className="text-left mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nom de la zone</label>
                      <input 
                        type="text" 
                        value={annotationLabel}
                        onChange={(e) => setAnnotationLabel(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Ex: Tumeur lobe gauche..."
                      />
                  </div>

                  <div className="flex gap-3">
                      <button 
                        onClick={() => setShowSaveModal(false)}
                        className="flex-1 py-3 rounded-lg font-bold bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
                      >
                          Annuler
                      </button>
                      <button 
                        onClick={handleExtractZone}
                        disabled={loading}
                        className="flex-1 py-3 rounded-lg font-bold bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:scale-105 transition-all shadow-lg shadow-emerald-900/20"
                      >
                          {loading ? "Traitement..." : "Sauvegarder"}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}