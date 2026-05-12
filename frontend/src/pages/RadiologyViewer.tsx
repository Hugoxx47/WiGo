import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";

import ContrastIcon from '@mui/icons-material/Contrast';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import StraightenIcon from '@mui/icons-material/Straighten';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TextFormatIcon from '@mui/icons-material/TextFormat';

// --- IMPORTATION CORNERSTONE ---
import cornerstone from "cornerstone-core";
import cornerstoneMath from "cornerstone-math";
// @ts-ignore
import cornerstoneTools from "cornerstone-tools";
import dicomParser from "dicom-parser";
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
// @ts-ignore
import Hammer from "hammerjs";

let isCornerstoneInitialized = false;
const initCornerstone = () => {
  if (isCornerstoneInitialized) return;

  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.Hammer = Hammer;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;

  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

  cornerstoneWADOImageLoader.configure({ useWebWorkers: false });
  cornerstoneTools.init({ showSVGCursors: true });

  isCornerstoneInitialized = true;
};

export default function RadiologyViewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const patientId = searchParams.get("patient") || "Inconnu";
  const studyId = searchParams.get("study");

  const [report, setReport] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTool, setActiveTool] = useState("Wwwc");

  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studyId || !viewerRef.current) return;
    initCornerstone();
    
    // 🌟 On cible l'élément React exact
    const element = viewerRef.current;

    const loadDataAndDicom = async () => {
      try {
        const dbRes = await fetch(`http://localhost:8000/radiology/${studyId}/report`);
        const dbData = await dbRes.json();
        if (dbData.report) setReport(dbData.report);

        const response = await fetch(`/orthanc/studies/${studyId}/instances`);
        if (!response.ok) throw new Error("Erreur de connexion API Orthanc");

        const instances = await response.json();
        if (!instances || instances.length === 0) throw new Error("Aucune image trouvée.");

        const firstInstanceId = instances[0].ID;
        const dicomUrl = `wadouri:${window.location.origin}/orthanc/instances/${firstInstanceId}/file`;

        // 🌟 1. On active l'élément
        cornerstone.enable(element);

        // 🌟 2. On attache les outils UNIQUEMENT à cet élément (Le remède anti-bug !)
        const toolsToLoad = [
          cornerstoneTools.WwwcTool,
          cornerstoneTools.ZoomTool,
          cornerstoneTools.PanTool,
          cornerstoneTools.ZoomMouseWheelTool,
          cornerstoneTools.LengthTool,
          cornerstoneTools.RectangleRoiTool,
          cornerstoneTools.EllipticalRoiTool,
          cornerstoneTools.ArrowAnnotateTool
        ];

        toolsToLoad.forEach(ToolClass => {
          try { cornerstoneTools.addToolForElement(element, ToolClass); } catch (e) { /* ignore */ }
        });

        // 🌟 3. On charge et affiche l'image
        const image = await cornerstone.loadImage(dicomUrl);
        cornerstone.displayImage(element, image);

        // 🌟 4. On active la souris
        cornerstoneTools.setToolActiveForElement(element, "ZoomMouseWheel", { mouseButtonMask: 0 });
        cornerstoneTools.setToolActiveForElement(element, "Wwwc", { mouseButtonMask: 1 });

        // 🌟 5. On restaure les dessins existants
        if (dbData.annotations) {
          const parsedState = JSON.parse(dbData.annotations);
          cornerstoneTools.globalImageIdSpecificToolStateManager.restoreState(parsedState);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Erreur de chargement :", error);
        setIsLoading(false);
      }
    };

    loadDataAndDicom();

    // 🌟 NETTOYAGE PROPRE QUAND ON QUITTE LA PAGE
    return () => {
      try { cornerstone.disable(element); } catch(e) {}
    };
  }, [studyId]);

  const handleSaveReport = async () => {
    if (!studyId) return;
    setIsSaving(true);
    try {
      const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveState();
      const annotationsStr = JSON.stringify(toolState);

      const res = await fetch(`http://localhost:8000/radiology/${studyId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: report, annotations: annotationsStr }),
      });
      
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const changeTool = (toolName: string) => {
    if (!viewerRef.current) return;
    const element = viewerRef.current;
    
    // On met en pause tous les outils sur cet élément spécifique
    const allTools = ['Wwwc', 'Zoom', 'Pan', 'Length', 'RectangleRoi', 'EllipticalRoi', 'ArrowAnnotate'];
    allTools.forEach(t => {
        try { cornerstoneTools.setToolPassiveForElement(element, t); } catch(e) {}
    });
    
    // On active le nouvel outil
    cornerstoneTools.setToolActiveForElement(element, toolName, { mouseButtonMask: 1 });
    setActiveTool(toolName);
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col font-sans text-white overflow-hidden">
      
      <div className="bg-slate-950 border-b border-slate-800 p-3 flex justify-between items-center z-20 shadow-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
            <ArrowBackIcon />
          </button>
          <div>
            <h1 className="font-bold text-white flex items-center gap-2">DPI - Imagerie Radiologique</h1>
            <p className="text-xs text-cyan-500 font-mono">Patient ID: {patientId}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        <div className="flex-1 flex flex-col relative bg-black border-r border-slate-800">
            
            <div className="flex flex-wrap gap-2 bg-slate-900 p-2 border-b border-slate-800 shadow-inner justify-center z-10">
                <button onClick={() => changeTool('Wwwc')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${activeTool === 'Wwwc' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <ContrastIcon fontSize="small"/> Contraste
                </button>
                <button onClick={() => changeTool('Pan')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${activeTool === 'Pan' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <OpenWithIcon fontSize="small"/> Déplacer
                </button>
                
                <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>

                <button onClick={() => changeTool('Length')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${activeTool === 'Length' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <StraightenIcon fontSize="small"/> Mesurer
                </button>
                <button onClick={() => changeTool('RectangleRoi')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${activeTool === 'RectangleRoi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <CropSquareIcon fontSize="small"/> Rect.
                </button>
                <button onClick={() => changeTool('EllipticalRoi')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${activeTool === 'EllipticalRoi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <RadioButtonUncheckedIcon fontSize="small"/> Cercle
                </button>
                <button onClick={() => changeTool('ArrowAnnotate')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${activeTool === 'ArrowAnnotate' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <TextFormatIcon fontSize="small"/> Texte
                </button>
            </div>

            <div className="flex-1 relative flex items-center justify-center">
                {isLoading && <div className="absolute text-slate-400 font-mono animate-pulse z-20">Chargement DICOM...</div>}
                <div
                    ref={viewerRef}
                    className="w-full h-full cursor-crosshair"
                    onContextMenu={(e) => e.preventDefault()}
                />
            </div>
        </div>

        <div className="w-[350px] bg-slate-900 flex flex-col p-5 shadow-2xl z-10">
          <div className="flex justify-between items-start mb-4 border-b border-slate-700 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Compte-Rendu</h2>
              <p className="text-xs text-slate-400 mt-1">Examen radiologique</p>
            </div>
          </div>

          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Tapez vos observations cliniques ici..."
            className="flex-1 w-full bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none custom-scrollbar shadow-inner leading-relaxed"
          />

          <button
            onClick={handleSaveReport}
            disabled={isSaving}
            className={`mt-4 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg ${saved ? "bg-emerald-600 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/50"}`}
          >
            {saved ? <><CheckCircleIcon fontSize="small" /> Sauvegardé</> : <><SaveIcon fontSize="small" /> Sauvegarder</>}
          </button>
        </div>
      </div>
    </div>
  );
}