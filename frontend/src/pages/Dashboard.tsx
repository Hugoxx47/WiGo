import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatients, type Patient } from '../services/api';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import PersonIcon from '@mui/icons-material/Person';
import AnalyticsIcon from '@mui/icons-material/Analytics';

// Composant Carte KPI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-all">
    <div>
      <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-white">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
      <Icon className={color.replace('bg-', 'text-')} />
    </div>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  
  // Récupérer le nom de l'utilisateur connecté (ou "Inconnu" par défaut)
  const username = localStorage.getItem("biopsie_user") || "Invité";

  // Générer les initiales (ex: "Thomas Anderson" -> "TA")
  const initials = username
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getPatients();
      setPatients(data);
    };
    fetchData();
  }, []);

  // --- CALCUL DES STATISTIQUES RÉELLES ---
  const stats = useMemo(() => {
    let totalBiopsies = 0;
    let criticalCases = 0;
    let validatedCases = 0;

    patients.forEach(patient => {
      patient.biopsies.forEach(biopsy => {
        totalBiopsies++;
        if (biopsy.status === "À vérifier") criticalCases++;
        if (biopsy.status === "Validé") validatedCases++;
      });
    });

    // Calcul du taux de validation (Biopsies saines / Total analysé)
    // Si on a 0 biopsie, on met 0% pour éviter la division par zéro
    const safeRate = totalBiopsies > 0 
        ? Math.round((validatedCases / totalBiopsies) * 100) 
        : 0;

    return { totalBiopsies, criticalCases, safeRate };
  }, [patients]); // Se recalcule uniquement quand 'patients' change

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-slate-900 to-transparent -z-10"></div>

      <div className="max-w-7xl mx-auto z-10 relative">
        
        {/* En-tête Dynamique */}
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              Tableau de Bord
            </h1>
            <p className="text-slate-400 mt-2">Bienvenue, {username}</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-white">Service Oncologie</p>
                <p className="text-xs text-green-400">● Système IA Connecté</p>
             </div>
             {/* Initiales dynamiques */}
             <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
                {initials}
             </div>
          </div>
        </header>

        {/* Section KPIs (Stats Réelles) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard 
            title="Patients Suivis" 
            value={patients.length} 
            icon={PersonIcon} 
            color="text-blue-400" 
          />
          <StatCard 
            title="Total Biopsies" 
            value={stats.totalBiopsies} 
            icon={SmartToyIcon} 
            color="text-purple-400" 
          />
          <StatCard 
            title="Cas Critiques" 
            value={stats.criticalCases} 
            icon={AnalyticsIcon} 
            color="text-red-400" 
          />
          {/* On remplace "Précision" (qu'on ne stocke pas) par "Taux de cas Sains" qui est calculable */}
          <StatCard 
            title="Taux Cas Sains" 
            value={`${stats.safeRate}%`} 
            icon={AnalyticsIcon} 
            color="text-emerald-400" 
          />
        </div>

        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <FolderSharedIcon className="text-slate-500" />
            Dossiers Récents
        </h2>

        {/* Grille des patients */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => (
            <div key={patient.id} className="group bg-slate-900 border border-slate-800 rounded-2xl p-0 overflow-hidden hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-900/10 transition-all duration-300">
              
              <div className="p-6 relative">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{patient.name}</h3>
                        <p className="text-slate-500 text-sm">Dossier #{patient.folder_id}</p>
                    </div>
                    <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs font-mono">
                        {patient.age} ans
                    </span>
                 </div>

                 <div className="flex items-center gap-3 mb-6">
                    {patient.biopsies.length > 0 ? (
                        patient.biopsies.map(biopsy => (
                            <span key={biopsy.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                                biopsy.status === "Validé" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : biopsy.status === "À vérifier"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    biopsy.status === "Validé" ? "bg-emerald-400" : 
                                    biopsy.status === "À vérifier" ? "bg-red-400" : "bg-amber-400"
                                }`}></span>
                                {biopsy.status}
                            </span>
                        ))
                    ) : (
                        <span className="text-slate-600 text-sm italic py-1.5">Aucune biopsie</span>
                    )}
                 </div>

                 {patient.biopsies.length > 0 && (
                  <button 
                    onClick={() => navigate('/viewer')}
                    className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-cyan-600 hover:text-white transition-all flex items-center justify-center gap-2 group-hover:translate-y-0"
                  >
                    <SmartToyIcon fontSize="small" />
                    Analyser
                  </button>
                 )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}