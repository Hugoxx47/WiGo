import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function RadiologyViewer() {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const patientId = searchParams.get("patient") || "Inconnu";
  const studyId = searchParams.get("study");

  const [report, setReport] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // L'URL qui auto-charge l'image
  const ORTHANC_VIEWER_URL = studyId
    ? `http://localhost:8042/stone-webviewer/index.html?study=${studyId}`
    : "http://localhost:8042/stone-webviewer/index.html";

  // Charger le compte-rendu existant depuis PostgreSQL
  useEffect(() => {
    if (studyId) {
      fetch(`http://localhost:8000/radiology/${studyId}/report`)
        .then((res) => res.json())
        .then((data) => {
          if (data.report) setReport(data.report);
        })
        .catch((err) => console.error("Erreur de chargement du rapport", err));
    }
  }, [studyId]);

  // Sauvegarder le compte-rendu
  const handleSaveReport = async () => {
    if (!studyId) return;
    setIsSaving(true);
    try {
      const res = await fetch(
        `http://localhost:8000/radiology/${studyId}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report: report }),
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
      {/* HEADER */}
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
              DPI - Imagerie Radiologique (DICOM)
            </h1>
            <p className="text-xs text-cyan-500 font-mono">
              Patient ID: {patientId} | Source: Serveur PACS Orthanc
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ZONE DE RENDU I-FRAME (La Radio auto-chargée) */}
        <div className="flex-1 relative bg-black">
          {studyId ? (
            <iframe
              src={ORTHANC_VIEWER_URL}
              className="w-full h-full border-none"
              title="Orthanc Stone Viewer"
              allowFullScreen
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Aucun examen radiologique trouvé pour ce patient.
            </div>
          )}
        </div>

        {/* LE PANNEAU DE COMPTE-RENDU (Sauvegardé en BDD) */}
        <div className="w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col p-4 shadow-2xl z-10">
          <div className="flex justify-between items-start mb-4 border-b border-slate-700 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Compte-Rendu</h2>
              <p className="text-xs text-slate-400 mt-1">Examen radiologique</p>
            </div>
            {/* Petits tags de contexte médical */}
            <div className="flex flex-col gap-1 items-end">
              <span className="px-2 py-1 bg-indigo-900/50 text-indigo-300 text-[10px] font-bold rounded uppercase tracking-wider border border-indigo-700/50">
                DICOM Validé
              </span>
              <span className="px-2 py-1 bg-slate-800 text-slate-400 text-[10px] font-mono rounded border border-slate-700">
                PACS: Connecté
              </span>
            </div>
          </div>

          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Ex: Présence d'une masse de 12mm dans le lobe supérieur..."
            className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none custom-scrollbar shadow-inner"
          />

          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={handleSaveReport}
              disabled={isSaving}
              className={`py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg ${saved ? "bg-emerald-600 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/50"}`}
            >
              {saved ? (
                <>
                  <CheckCircleIcon fontSize="small" /> Enregistré au dossier
                </>
              ) : isSaving ? (
                "Sauvegarde..."
              ) : (
                <>
                  <SaveIcon fontSize="small" /> Sauvegarder
                </>
              )}
            </button>
            <button
              onClick={() => {
                const element = document.createElement("a");
                const file = new Blob(
                  [
                    `COMPTE RENDU RADIOLOGIQUE\nPatient ID: ${patientId}\n\n${report}`,
                  ],
                  { type: "text/plain" },
                );
                element.href = URL.createObjectURL(file);
                element.download = `CR_Radiologie_${patientId}.txt`;
                document.body.appendChild(element);
                element.click();
              }}
              className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-colors border border-slate-700 flex justify-center items-center gap-2"
            >
              Exporter le texte (.txt)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
