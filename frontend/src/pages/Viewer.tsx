import { useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { analyzeBiopsy, type AIResult } from '../services/api';

export default function Viewer() {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  useEffect(() => {
    if (viewerRef.current) return;

    const osd = OpenSeadragon({
      id: "osd-viewer",
      prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
      tileSources: {
        Image: {
          xmlns: "http://schemas.microsoft.com/deepzoom/2008",
          Url: "http://localhost:9000/biopsies/biopsie_cmu_1_files/",
          Format: "jpg",
          Overlap: "1",
          TileSize: "256",
          Size: { Height: "32914", Width: "46000" }
        }
      },
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT", // Mini-map en bas à droite
      wrapHorizontal: false,
      debugMode: false,
      showNavigationControl: false, // On fait nos propres boutons
    });

    viewerRef.current = osd;
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Fonctions de zoom manuelles
  const zoomIn = () => viewerRef.current?.viewport.zoomBy(1.2);
  const zoomOut = () => viewerRef.current?.viewport.zoomBy(0.8);

  const handleAnalyze = async () => {
    setLoading(true);
    const data = await analyzeBiopsy(1);
    setLoading(false);
    if (data) setResult(data);
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      
      {/* 1. La zone de l'image (Arrière-plan) */}
      <div id="osd-viewer" className="absolute inset-0 z-0" />

      {/* 2. Header Flottant (Top Bar) */}
      <div className="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
         <div className="pointer-events-auto bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-xl p-2 flex items-center gap-4 shadow-2xl">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ArrowBackIcon />
            </button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">Biopsie Pulmonaire</h1>
                <p className="text-xs text-slate-400">#CMU-1 • H&E Stain</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded">
                <ZoomInIcon fontSize="small" />
                x40 Natif
            </div>
         </div>

         {/* Bouton IA */}
         <div className="pointer-events-auto">
            <button 
                onClick={handleAnalyze}
                disabled={loading}
                className={`
                    flex items-center gap-3 px-6 py-3 rounded-xl font-bold shadow-xl transition-all
                    ${loading 
                        ? "bg-slate-800 text-slate-500 cursor-wait" 
                        : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-105 text-white"
                    }
                `}
            >
                {loading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                        <span>Analyse en cours...</span>
                    </>
                ) : (
                    <>
                        <SmartToyIcon />
                        <span>Lancer Diagnostic IA</span>
                    </>
                )}
            </button>
         </div>
      </div>

      {/* 3. Panel de Résultats (Apparaît à droite) */}
      {result && (
        <div className="absolute top-24 right-4 z-20 w-80 bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-6 animate-slide-in-right">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <SmartToyIcon className="text-cyan-400" />
                    Rapport IA
                </h2>
                <button onClick={() => setResult(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            <div className={`p-4 rounded-xl mb-4 text-center border ${result.cancer_detected ? "bg-red-500/10 border-red-500/50 text-red-400" : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"}`}>
                <p className="text-xs uppercase tracking-widest font-bold mb-1">Diagnostic</p>
                <p className="text-2xl font-black">{result.cancer_detected ? "ANOMALIE" : "SAIN"}</p>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-1 text-slate-300">
                        <span>Indice de Confiance</span>
                        <span>{Math.round(result.confidence * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${result.confidence * 100}%` }}></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-400">Cellules</p>
                        <p className="font-mono font-bold text-lg">{result.cells_count}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-400">Régions</p>
                        <p className="font-mono font-bold text-lg">{result.regions_found}</p>
                    </div>
                </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10 text-xs text-slate-500 flex items-start gap-2">
                <InfoOutlinedIcon fontSize="small" />
                <p>Ce résultat est une prédiction générée par IA. Une validation par un pathologiste certifié est requise.</p>
            </div>
        </div>
      )}

      {/* 4. Contrôles de Zoom (Bas Gauche) */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-full border border-slate-700">
        <button onClick={zoomOut} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition text-2xl font-light">-</button>
        <div className="w-px h-6 bg-white/20 my-auto"></div>
        <button onClick={zoomIn} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition text-2xl font-light">+</button>
      </div>

    </div>
  );
}