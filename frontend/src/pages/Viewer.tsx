import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { jsPDF } from "jspdf";

// --- ICONS ---
import PanToolIcon from '@mui/icons-material/PanTool';
import StraightenIcon from '@mui/icons-material/Straighten';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import LoupeIcon from '@mui/icons-material/Loupe';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DrawIcon from '@mui/icons-material/Draw'; 
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import { analyzeBiopsy, type AIResult } from '../services/api';

// --- IMPORTS ---
import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import cornerstoneMath from 'cornerstone-math';
import Hammer from 'hammerjs';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';

// --- CONFIGURATION ---
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = Hammer;
cornerstoneTools.external.cornerstoneMath = cornerstoneMath;

cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// WebWorker
cornerstoneWADOImageLoader.webWorkerManager.initialize({
    maxWebWorkers: navigator.hardwareConcurrency || 1,
    startWebWorkersOnDemand: true,
    taskConfiguration: {
        decodeTask: { initializeCodecsOnStartup: false },
    },
});

export default function Viewer() {
  const elementRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  const patientName = location.state?.patientName || "Patient Test";
  const folderId = location.state?.folderId || "X-00";
  const biopsyId = location.state?.biopsyId;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [reportText, setReportText] = useState("");
  const [activeTool, setActiveTool] = useState("Pan"); 

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const saveAnnotations = useCallback(() => {
    if (!biopsyId) return;
    const toolState = cornerstoneTools.globalImageIdSpecificToolStateManager.saveToolState();
    localStorage.setItem(`annotations_${biopsyId}`, JSON.stringify(toolState));
  }, [biopsyId]);

  const loadAnnotations = useCallback(() => {
    if (!biopsyId) return;
    cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState({});
    const savedState = localStorage.getItem(`annotations_${biopsyId}`);
    if (savedState) {
        const toolState = JSON.parse(savedState);
        cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState(toolState);
    }
  }, [biopsyId]);

  useEffect(() => {
    if (!elementRef.current) return;

    try { cornerstone.enable(elementRef.current); } catch { /* empty */ }

    // Init tools
    cornerstoneTools.init({ showSVGCursors: true, globalToolSyncEnabled: true });
    cornerstoneTools.toolColors.setToolColor("rgb(6, 182, 212)"); 
    cornerstoneTools.toolColors.setActiveColor("rgb(255, 200, 0)"); 
    cornerstoneTools.toolStyle.setToolWidth(3);

    const loadOrthancImage = async () => {
        try {
            const response = await fetch('/orthanc/instances');
            
            if (!response.ok) throw new Error("Erreur réseau Orthanc");

            const instances = await response.json();

            if (instances.length === 0) {
                alert("Orthanc est vide. Lancez le script Python !");
                return;
            }

            // Get last uploaded image
            const instanceId = instances[instances.length - 1]; 
            const imageId = `wadouri:${window.location.origin}/orthanc/instances/${instanceId}/file`;

            cornerstone.loadImage(imageId).then((image: unknown) => {
                if (!elementRef.current) return;
                cornerstone.displayImage(elementRef.current, image);

                // --- TOOLS ---
                const tools = [
                    cornerstoneTools.PanTool, cornerstoneTools.ZoomTool,
                    cornerstoneTools.LengthTool, cornerstoneTools.RectangleRoiTool,
                    cornerstoneTools.ArrowAnnotateTool, cornerstoneTools.FreehandRoiTool, 
                    cornerstoneTools.ZoomMouseWheelTool
                ];
                
                try { cornerstoneTools.addTool(cornerstoneTools.MagnifyTool, { magnifySize: 350, magnificationLevel: 4 }); } catch { /* */ }
                tools.forEach(t => { try { cornerstoneTools.addTool(t); } catch { /* */ } });

                cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
                cornerstoneTools.setToolActive('ZoomMouseWheel', {});

                loadAnnotations();

                setTimeout(() => {
                    if (elementRef.current) {
                        cornerstone.fitToWindow(elementRef.current);
                        cornerstone.updateImage(elementRef.current); 
                    }
                }, 100); 

            }).catch((err: unknown) => {
                console.error("Erreur Cornerstone:", err);
            });

        } catch (error) {
            console.error("Erreur connexion Orthanc:", error);
            alert("Impossible de contacter Orthanc.");
        }
    };

    loadOrthancImage();

    const currentElement = elementRef.current;
    return () => {
      saveAnnotations();
      if (currentElement) {
        try { cornerstone.disable(currentElement); } catch { /* empty */ }
      }
    };
  }, [biopsyId, loadAnnotations, saveAnnotations]);

  // --- Handlers ---
  const deleteSelected = () => {
    if (!elementRef.current) return;
    const toolsToCheck = ['Length', 'RectangleRoi', 'ArrowAnnotate', 'FreehandRoi'];
    let somethingDeleted = false;
    toolsToCheck.forEach(toolName => {
        const toolState = cornerstoneTools.getToolState(elementRef.current, toolName);
        if (toolState && toolState.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const keptData = toolState.data.filter((data: any) => data.active !== true);
            if (keptData.length !== toolState.data.length) {
                toolState.data = keptData;
                somethingDeleted = true;
            }
        }
    });
    if (somethingDeleted) {
        cornerstone.updateImage(elementRef.current);
        saveAnnotations();
    } else {
        alert("Sélectionnez d'abord un dessin (clic dessus -> jaune) pour le supprimer.");
    }
  };

  const clearAllAnnotations = () => {
    if (!elementRef.current) return;
    if (window.confirm("Voulez-vous vraiment supprimer toutes les annotations ?")) {
        cornerstoneTools.globalImageIdSpecificToolStateManager.restoreToolState({});
        cornerstone.updateImage(elementRef.current);
        saveAnnotations();
    }
  };

  const resetViewport = () => {
    if (!elementRef.current) return;
    cornerstone.fitToWindow(elementRef.current);
    cornerstone.updateImage(elementRef.current);
  };

  const switchTool = (toolName: string) => {
    setActiveTool(toolName);
    const tools = ['Pan', 'Length', 'RectangleRoi', 'ArrowAnnotate', 'Magnify', 'FreehandRoi'];
    tools.forEach(t => cornerstoneTools.setToolPassive(t));
    cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 });
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Micro non supporté.");
    if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
    } else {
        try { recognitionRef.current.start(); setIsListening(true); } 
        catch { setIsListening(false); }
    }
  };

  const handleAnalyze = async () => {
    if (!biopsyId) return alert("Erreur ID");
    setLoading(true);
    try {
        const data = await analyzeBiopsy(biopsyId);
        if (data) setResult(data);
    } catch (error) {
        console.error("Erreur analyse:", error);
        alert("Erreur analyse");
    } finally {
        setLoading(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();
    doc.setFontSize(22); doc.setTextColor(0, 150, 200);
    doc.text("RAPPORT D'ANALYSE PATHOLOGIQUE", 20, 20);
    doc.setFontSize(12); doc.setTextColor(0, 0, 0);
    doc.text(`Patient: ${patientName}`, 20, 40);
    doc.text(`Dossier ID: #${folderId}`, 20, 50);
    doc.text(`Date: ${date}`, 20, 60);
    doc.setLineWidth(0.5); doc.line(20, 80, 190, 80);
    if (result) {
        doc.setFontSize(16); doc.text("RÉSULTATS IA", 20, 95);
        doc.setFontSize(12);
        if(result.cancer_detected) doc.setTextColor(220, 0, 0); else doc.setTextColor(0, 150, 0);
        doc.text(`Diagnostic: ${result.cancer_detected ? "ANOMALIE DÉTECTÉE" : "TISSU SAIN"}`, 20, 105);
        doc.setTextColor(0, 0, 0);
        doc.text(`Confiance: ${Math.round(result.confidence * 100)}%`, 20, 115);
    } 
    doc.line(20, 140, 190, 140);
    doc.setFontSize(16); doc.text("OBSERVATIONS MÉDICALES", 20, 155);
    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(reportText || "Aucune observation.", 170);
    doc.text(splitText, 20, 165);
    doc.save(`Rapport.pdf`);
  };

  const getBtnClass = (toolName: string) =>`p-2 rounded transition-colors ${activeTool === toolName ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/50" : "hover:bg-white/10 text-cyan-400"}`;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'fr-FR';
        recognition.interimResults = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
            }
            if (finalTranscript) setReportText((prev: string) => prev + finalTranscript);
        };
        recognitionRef.current = recognition;
    }
    return () => { recognitionRef.current?.stop(); };
  }, []);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      <div 
        ref={elementRef} 
        className="absolute inset-0 z-0 bg-black cursor-crosshair"
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
         <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-2 flex items-center gap-4 shadow-2xl">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ArrowBackIcon /></button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">{patientName}</h1>
                <p className="text-xs text-slate-400">#{folderId}</p>
            </div>
            
            <div className="flex gap-1 ml-2 border-r border-white/10 pr-2">
                <button onClick={() => switchTool('Pan')} className={getBtnClass('Pan')} title="Déplacer"><PanToolIcon /></button>
                <button onClick={() => switchTool('Magnify')} className={getBtnClass('Magnify')} title="Loupe"><LoupeIcon /></button>
                <button onClick={() => switchTool('Length')} className={getBtnClass('Length')} title="Mesurer"><StraightenIcon /></button>
                <button onClick={() => switchTool('RectangleRoi')} className={getBtnClass('RectangleRoi')} title="Zone"><CropSquareIcon /></button>
                <button onClick={() => switchTool('FreehandRoi')} className={getBtnClass('FreehandRoi')} title="Dessin libre"><DrawIcon /></button>
                <button onClick={() => switchTool('ArrowAnnotate')} className={getBtnClass('ArrowAnnotate')} title="Annoter"><ArrowOutwardIcon /></button>
            </div>

            <div className="flex gap-2 ml-2">
                <button onClick={resetViewport} className="p-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-all"><RestartAltIcon /></button>
                <button onClick={deleteSelected} className="p-2 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/30"><DeleteForeverIcon /></button>
                <button onClick={clearAllAnnotations} className="p-2 rounded bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"><DeleteSweepIcon /></button>
            </div>
         </div>

         <div className="pointer-events-auto flex gap-3">
            <button onClick={handleAnalyze} disabled={loading} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-xl transition-all ${loading ? "bg-slate-800 text-slate-500 cursor-wait" : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-105 text-white"}`}>
                {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Analyse...</> : <><SmartToyIcon /> Lancer IA</>}
            </button>
            <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold transition-all">
                <PictureAsPdfIcon className="text-red-400" /> Export
            </button>
         </div>
      </div>
      
      <div className="absolute bottom-8 left-8 z-10 w-80 bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-4">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-slate-300">Compte Rendu Vocal</h2>
            <button onClick={toggleListening} className={`p-2 rounded-full transition-all ${isListening ? "bg-red-500 animate-pulse text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}>
                {isListening ? <MicIcon /> : <MicOffIcon />}
            </button>
        </div>
        <textarea className="w-full h-32 bg-black/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none" placeholder="Cliquez sur le micro..." value={reportText} onChange={(e) => setReportText(e.target.value)}/>
      </div>

      {result && (
        <div className="absolute top-24 right-4 z-20 w-72 bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-5 animate-slide-in-right">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold flex items-center gap-2"><SmartToyIcon className="text-cyan-400" /> Rapport IA</h2>
                <button onClick={() => setResult(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className={`p-3 rounded-lg text-center border mb-4 ${result.cancer_detected ? "bg-red-500/10 border-red-500/50 text-red-400" : "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"}`}>
                <p className="text-xl font-black">{result.cancer_detected ? "ANOMALIE" : "SAIN"}</p>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between"><span>Confiance:</span> <span className="text-white font-bold">{Math.round(result.confidence * 100)}%</span></div>
                <div className="flex justify-between"><span>Cellules:</span> <span className="text-white font-bold">{result.cells_count}</span></div>
            </div>
        </div>
      )}
    </div>
  );
}