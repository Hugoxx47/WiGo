import { useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { analyzeBiopsy, type AIResult } from '../services/api';
import { jsPDF } from "jspdf";

export default function Viewer() {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // RÉCUPÉRATION DES DONNÉES (Avec sécurités)
  const patientName = location.state?.patientName || "Patient Test";
  const folderId = location.state?.folderId || "X-00";
  const biopsyId = location.state?.biopsyId; // L'ID qui manquait !

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [reportText, setReportText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (viewerRef.current) return;

    // Si on arrive ici sans ID (ex: refresh page), on alerte
    if (!biopsyId) console.warn("Aucun ID de biopsie fourni !");

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
      navigatorPosition: "BOTTOM_RIGHT",
      wrapHorizontal: false,
      debugMode: false,
      showNavigationControl: false,
    });
    viewerRef.current = osd;

    // --- MICRO ---
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
            if (finalTranscript) setReportText(prev => prev + finalTranscript);
        };
        recognitionRef.current = recognition;
    }

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      recognitionRef.current?.stop();
    };
  }, [biopsyId]);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Micro non supporté (Utilisez Chrome/Edge).");
    if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
    } else {
        try { recognitionRef.current.start(); setIsListening(true); } 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        catch (e) { setIsListening(false); }
    }
  };

  // --- CORRECTION DU BLOCAGE BOUTON ---
  const handleAnalyze = async () => {
    if (!biopsyId) {
        alert("Erreur : ID de biopsie manquant. Retournez au Dashboard.");
        return;
    }

    setLoading(true); // Bloque le bouton
    try {
        // Appel API avec le VRAI ID
        const data = await analyzeBiopsy(biopsyId);
        if (data) setResult(data);
        else alert("Erreur lors de l'analyse (Backend hors ligne ?)");
    } catch (error) {
        console.error("Crash analyse:", error);
        alert("Erreur technique lors de l'analyse.");
    } finally {
        setLoading(false); // DÉBLOQUE LE BOUTON DANS TOUS LES CAS
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
    doc.text(`Médecin: ${localStorage.getItem("biopsie_user") || "Dr. House"}`, 20, 70);
    doc.setLineWidth(0.5); doc.line(20, 80, 190, 80);

    if (result) {
        doc.setFontSize(16); doc.text("RÉSULTATS IA", 20, 95);
        doc.setFontSize(12);
        if(result.cancer_detected) doc.setTextColor(220, 0, 0); else doc.setTextColor(0, 150, 0);
        doc.text(`Diagnostic: ${result.cancer_detected ? "ANOMALIE DÉTECTÉE" : "TISSU SAIN"}`, 20, 105);
        doc.setTextColor(0, 0, 0);
        doc.text(`Confiance: ${Math.round(result.confidence * 100)}%`, 20, 115);
        doc.text(`Cellules analysées: ${result.cells_count}`, 20, 125);
    } else { doc.text("Analyse IA non effectuée.", 20, 95); }

    doc.line(20, 140, 190, 140);
    doc.setFontSize(16); doc.text("OBSERVATIONS MÉDICALES", 20, 155);
    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(reportText || "Aucune observation.", 170);
    doc.text(splitText, 20, 165);
    doc.save(`Rapport_${patientName.replace(' ', '_')}.pdf`);
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      <div id="osd-viewer" className="absolute inset-0 z-0" />
      <div className="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
         <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl p-2 flex items-center gap-4 shadow-2xl">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ArrowBackIcon /></button>
            <div className="pr-4 border-r border-white/10">
                <h1 className="font-bold text-sm">{patientName}</h1>
                <p className="text-xs text-slate-400">#{folderId} • H&E Stain</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded">
                <ZoomInIcon fontSize="small" /> x40
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