import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import OpenSeadragon from 'openseadragon'; 
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HandymanIcon from '@mui/icons-material/Handyman';

export default function Viewer() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const patientName = location.state?.patientName || "Patient";
  const folderId = location.state?.folderId || "X-00";
  // On récupère le nom du fichier DZI depuis l'état de navigation ou on met le défaut
  const dziFilename = location.state?.image_url || "biopsie_cmu_1.dzi"; 

  const [loading, setLoading] = useState(false);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);

  // --- INITIALISATION OPENSEADRAGON ---
  useEffect(() => {
    // L'URL pointe vers le dossier statique du backend
    // Assure-toi que ton backend a bien la ligne : app.mount("/dzi", StaticFiles(...))
    const tileSource = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/dzi/${dziFilename}`;

    // Si un viewer existe déjà, on le détruit pour éviter les doublons
    if (viewerRef.current) {
        viewerRef.current.destroy();
    }

    try {
        // Création de l'instance OpenSeadragon
        viewerRef.current = OpenSeadragon({
            id: "openseadragon-viewer",
            // Utilise les icônes par défaut d'OpenSeadragon
            prefixUrl: "https://openseadragon.github.io/openseadragon/images/", 
            tileSources: tileSource,
            showNavigator: true, // Petit plan de navigation
            animationTime: 0.5,
            blendTime: 0.1,
            constrainDuringPan: true,
            
            // --- CONFIGURATION ZOOM PUISSANT ---
            maxZoomPixelRatio: 10, 
            minZoomLevel: 0.5,
            defaultZoomLevel: 0,
            visibilityRatio: 1,
            
            // Boutons de contrôle (liés aux IDs HTML plus bas)
            zoomInButton: "zoom-in",
            zoomOutButton: "zoom-out",
            homeButton: "home",
            fullPageButton: "full-page",
        });
    } catch (e) {
        console.error("Erreur initialisation OSD:", e);
    }

    // Nettoyage quand on quitte la page
    return () => {
        if (viewerRef.current) viewerRef.current.destroy();
    };
  }, [dziFilename]); // Se relance si le nom du fichier change

  // --- CONVERSION SVS (BACKEND) ---
  const handleConvertToSVS = async () => {
      if(!window.confirm(`Reconstruire le fichier SVS original à partir des tuiles ?\n(Fichier : ${dziFilename})`)) return;
      
      setLoading(true);
      try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/stitch-dzi/${dziFilename}`, {
              method: 'POST'
          });
          
          if(res.ok) {
              const data = await res.json();
              alert(`✅ SUCCÈS ! Fichier SVS généré dans le dossier backend/dzi_data.\nNom: ${data.file}`);
          } else {
              const err = await res.json();
              alert(`Erreur Backend : ${err.detail}`);
          }
      } catch (err) {
          console.error(err);
          alert("Erreur réseau : Vérifiez que le backend tourne.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      
      {/* CONTENEUR DU VIEWER (DOIT PRENDRE TOUTE LA PLACE) */}
      <div id="openseadragon-viewer" className="absolute inset-0 z-0 bg-black" style={{width: '100%', height: '100%'}} />

      {/* HEADER FLOTTANT */}
      <div className="absolute top-0 left-0 w-full p-4 z-10 flex justify-between pointer-events-none">
         <div className="pointer-events-auto bg-slate-900/90 border border-slate-700 rounded-xl p-2 flex items-center gap-4 shadow-2xl backdrop-blur-md">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ArrowBackIcon /></button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">{patientName}</h1>
                <p className="text-xs text-slate-400">#{folderId}</p>
            </div>
            
            <div className="flex gap-2 ml-2">
                <button id="zoom-in" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold" title="Zoomer">+</button>
                <button id="zoom-out" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold" title="Dézoomer">-</button>
                <button id="home" className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold" title="Reset">⟲</button>
            </div>
         </div>

         <div className="pointer-events-auto flex gap-3">
            <button 
                onClick={handleConvertToSVS} 
                disabled={loading}
                className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${loading ? "bg-slate-700 text-slate-500" : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105 text-white"}`}
            >
                {loading ? "Reconstruction..." : <><HandymanIcon /> Créer SVS</>}
            </button>
         </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
          <p className="text-xs text-slate-500 bg-black/50 p-2 rounded">Visualiseur Deep Zoom (DZI)</p>
      </div>
    </div>
  );
}