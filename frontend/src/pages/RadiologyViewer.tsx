import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";

// --- IMPORTATION DU MOTEUR CORNERSTONE (Natif) ---
import cornerstone from "cornerstone-core";
import cornerstoneMath from "cornerstone-math";
import cornerstoneTools from "cornerstone-tools";
import dicomParser from "dicom-parser";
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import Hammer from "hammerjs";

// Initialisation globale
let isCornerstoneInitialized = false;
const initCornerstone = () => {
  if (isCornerstoneInitialized) return;

  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.Hammer = Hammer;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;

  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

  cornerstoneWADOImageLoader.configure({ useWebWorkers: false });
  cornerstoneTools.init();

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

  const viewerRef = useRef<HTMLDivElement>(null);

  // CHARGEMENT DE L'IMAGE ET DES ANNOTATIONS
  useEffect(() => {
    if (!studyId || !viewerRef.current) return;
    initCornerstone();

    const loadDataAndDicom = async () => {
      try {
        // 1. Récupérer le texte et les annotations depuis PostgreSQL
        const dbRes = await fetch(
          `http://localhost:8000/radiology/${studyId}/report`,
        );
        const dbData = await dbRes.json();
        if (dbData.report) setReport(dbData.report);

        // 2. Demander à Orthanc les images de l'étude (Simple GET infaillible !)
        const response = await fetch(`/orthanc/studies/${studyId}/instances`);
        if (!response.ok) throw new Error("Erreur de connexion API Orthanc");

        const instances = await response.json();
        if (!instances || instances.length === 0)
          throw new Error("Aucune image trouvée.");

        // 3. Construire l'URL DICOM avec le champ "ID"
        const firstInstanceId = instances[0].ID;
        const dicomUrl = `wadouri:${window.location.origin}/orthanc/instances/${firstInstanceId}/file`;

        // 4. Dessiner l'image dans le Canvas
        cornerstone.enable(viewerRef.current!);
        const image = await cornerstone.loadImage(dicomUrl);
        cornerstone.displayImage(viewerRef.current!, image);

        // 5. Activer les outils
        const WwwcTool = cornerstoneTools.WwwcTool;
        const ZoomTool = cornerstoneTools.ZoomTool;
        const PanTool = cornerstoneTools.PanTool;
        const LengthTool = cornerstoneTools.LengthTool;

        cornerstoneTools.addTool(WwwcTool);
        cornerstoneTools.addTool(ZoomTool);
        cornerstoneTools.addTool(PanTool);
        cornerstoneTools.addTool(LengthTool);

        cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 });
        cornerstoneTools.setToolActive("Zoom", { mouseButtonMask: 2 });
        cornerstoneTools.setToolActive("Length", { mouseButtonMask: 4 });

        // 6. Réinjecter les dessins s'ils existent en base
        if (dbData.annotations) {
          const parsedState = JSON.parse(dbData.annotations);
          cornerstoneTools.globalImageIdSpecificToolStateManager.restoreState(
            parsedState,
          );
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Erreur de chargement :", error);
        setIsLoading(false);
      }
    };

    loadDataAndDicom();

    return () => {
      if (viewerRef.current) cornerstone.disable(viewerRef.current);
    };
  }, [studyId]);

  // SAUVEGARDE DE TOUT (Texte + Dessins)
  const handleSaveReport = async () => {
    if (!studyId) return;
    setIsSaving(true);
    try {
      // 🌟 Extraction des dessins Cornerstone en JSON
      const toolState =
        cornerstoneTools.globalImageIdSpecificToolStateManager.saveState();
      const annotationsStr = JSON.stringify(toolState);

      const res = await fetch(
        `http://localhost:8000/radiology/${studyId}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report: report,
            annotations: annotationsStr, // On envoie le JSON des traits à FastAPI
          }),
        },
      );
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

  return (
    <div className="h-screen w-screen bg-black flex flex-col font-sans text-white overflow-hidden">
      <div className="bg-slate-950 border-b border-slate-800 p-3 flex justify-between items-center z-10 shadow-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <ArrowBackIcon />
          </button>
          <div>
            <h1 className="font-bold text-white flex items-center gap-2">
              DPI - Imagerie Radiologique
            </h1>
            <p className="text-xs text-cyan-500 font-mono">
              Patient ID: {patientId}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center text-sm text-cyan-400 bg-cyan-900/30 px-4 py-2 rounded-lg border border-cyan-800/50">
          <InfoIcon fontSize="small" />
          Clic G: Contraste | Clic Droit: Zoom | Molette: Tracer une Mesure
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LE VISUALISEUR NATIF */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {isLoading && (
            <div className="absolute text-slate-400 font-mono animate-pulse">
              Décodage des pixels DICOM...
            </div>
          )}
          <div
            ref={viewerRef}
            className="w-full h-full"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        {/* PANNEAU DE SAUVEGARDE */}
        <div className="w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col p-5 shadow-2xl z-10">
          <div className="flex justify-between items-start mb-4 border-b border-slate-700 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Compte-Rendu</h2>
              <p className="text-xs text-slate-400 mt-1">Examen radiologique</p>
            </div>
          </div>

          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Ex: Présence d'une masse..."
            className="flex-1 w-full bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none custom-scrollbar shadow-inner leading-relaxed"
          />

          <button
            onClick={handleSaveReport}
            disabled={isSaving}
            className={`mt-4 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg ${saved ? "bg-emerald-600 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/50"}`}
          >
            {saved ? (
              <>
                <CheckCircleIcon fontSize="small" /> Mesures & Texte Enregistrés
              </>
            ) : (
              <>
                <SaveIcon fontSize="small" /> Sauvegarder
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
