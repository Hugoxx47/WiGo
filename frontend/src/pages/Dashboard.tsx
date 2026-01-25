import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatients, type Patient } from '../services/api';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import PersonIcon from '@mui/icons-material/Person';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LogoutIcon from '@mui/icons-material/Logout';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-all shadow-lg">
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
  const [loading, setLoading] = useState(true);
  
  const username = localStorage.getItem("biopsie_user") || "Invité";
  const initials = username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // --- LOGIQUE DE RESET AUTOMATIQUE & CHARGEMENT ---
  useEffect(() => {
    const initDashboard = async () => {
        const lastUser = localStorage.getItem("last_active_user");

        // 1. Si l'utilisateur a changé, on RESET la base de données
        if (lastUser !== username) {
            console.log("🔄 Nouvel utilisateur : Reset complet des données...");
            try {
                await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/seed`, { method: 'POST' });
                // On met à jour l'utilisateur pour ne pas le refaire au prochain F5
                localStorage.setItem("last_active_user", username);
            } catch (error) {
                console.error("Erreur Reset Auto:", error);
            }
        }

        // 2. Ensuite, on charge les données (qui seront vierges si on vient de reset)
        try {
            const data = await getPatients();
            setPatients(data);
        } catch (error) {
            console.error("Erreur chargement patients:", error);
        } finally {
            setLoading(false);
        }
    };

    initDashboard();
  }, [username]);

  // --- CALCUL DES STATS ---
  const { stats, pieData, activityData, hasActivity } = useMemo(() => {
    let totalPatients = 0;
    let analyzedCount = 0;
    let criticalCases = 0;
    let validatedCases = 0;

    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const todayIndex = new Date().getDay();
    const weekActivity = days.map(day => ({ name: day, analyses: 0 }));

    patients.forEach(patient => {
      totalPatients++;
      patient.biopsies.forEach(biopsy => {
        // On ne compte dans les stats QUE si c'est fait
        if (biopsy.status === "Validé" || biopsy.status === "À vérifier") {
            analyzedCount++;
            weekActivity[todayIndex].analyses += 1;

            if (biopsy.status === "À vérifier") criticalCases++;
            if (biopsy.status === "Validé") validatedCases++;
        }
      });
    });

    const safeRate = analyzedCount > 0 
        ? Math.round((validatedCases / analyzedCount) * 100) 
        : 0;

    const pData = [
      { name: 'Sains', value: validatedCases },
      { name: 'Anomalies', value: criticalCases },
    ].filter(d => d.value > 0);

    return { 
        stats: { totalPatients, analyzedCount, criticalCases, safeRate },
        pieData: pData,
        activityData: weekActivity,
        hasActivity: analyzedCount > 0
    };
  }, [patients]);

  const handleLogout = () => {
      navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-slate-900 to-transparent -z-10"></div>

      <div className="max-w-7xl mx-auto z-10 relative">
        
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Tableau de Bord</h1>
            <p className="text-slate-400 mt-2">Bienvenue, {username}</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20 ring-2 ring-slate-800">
                {initials}
             </div>
             <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-full hover:bg-red-500 hover:text-white transition-colors" title="Déconnexion">
                <LogoutIcon fontSize="small"/>
             </button>
          </div>
        </header>

        {loading ? (
            <div className="text-white text-center py-20 animate-pulse">Initialisation de l'environnement...</div>
        ) : (
            <>
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard title="Patients en File" value={stats.totalPatients} icon={PersonIcon} color="text-blue-400" />
                  <StatCard title="Analyses Terminées" value={stats.analyzedCount} icon={SmartToyIcon} color="text-purple-400" />
                  <StatCard title="Cas Critiques" value={stats.criticalCases} icon={AnalyticsIcon} color="text-red-400" />
                  <StatCard title="Taux Cas Sains" value={stats.analyzedCount > 0 ? `${stats.safeRate}%` : "-"} icon={AnalyticsIcon} color="text-emerald-400" />
                </div>

                {/* --- GRAPHIQUES --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    {!hasActivity ? (
                        <div className="col-span-3 bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div className="p-4 bg-slate-800 rounded-full mb-4">
                                <AccessTimeIcon className="text-slate-500 text-4xl" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-300">Prêt pour l'analyse</h3>
                            <p className="text-slate-500 mt-2 max-w-md">
                                Les statistiques apparaîtront ici dès que vous aurez analysé votre premier patient.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-fade-in">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <AnalyticsIcon className="text-cyan-500" /> Activité récente
                                </h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={activityData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} />
                                            <YAxis stroke="#94a3b8" tick={{fontSize: 12}} allowDecimals={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} cursor={{fill: '#334155', opacity: 0.4}} />
                                            <Bar dataKey="analyses" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col animate-fade-in">
                                <h3 className="text-lg font-bold text-white mb-2">Diagnostics</h3>
                                <div className="flex-grow h-64 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.name === 'Sains' ? '#10b981' : '#ef4444'} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                                        <span className="text-2xl font-bold text-white">{stats.analyzedCount}</span>
                                        <p className="text-xs text-slate-400">Total</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* --- LISTE PATIENTS --- */}
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FolderSharedIcon className="text-slate-500" /> File d'attente
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {patients.map((patient) => (
                    <div key={patient.id} className="group bg-slate-900 border border-slate-800 rounded-2xl p-0 overflow-hidden hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-900/10 transition-all duration-300">
                      <div className="p-6 relative">
                         <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{patient.name}</h3>
                                <p className="text-slate-500 text-sm">Dossier #{patient.folder_id}</p>
                            </div>
                            <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs font-mono">{patient.age} ans</span>
                         </div>

                         <div className="flex items-center gap-3 mb-6">
                            {patient.biopsies.length > 0 ? (
                                patient.biopsies.map(biopsy => (
                                    <span key={biopsy.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                                        biopsy.status === "Validé" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        biopsy.status === "À vérifier" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                        "bg-slate-700/30 text-slate-400 border-slate-700"
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            biopsy.status === "Validé" ? "bg-emerald-400" : 
                                            biopsy.status === "À vérifier" ? "bg-red-400" : "bg-slate-500"
                                        }`}></span>
                                        {biopsy.status}
                                    </span>
                                ))
                            ) : (<span className="text-slate-600 text-sm italic py-1.5">Aucune biopsie</span>)}
                         </div>

                         {patient.biopsies.length > 0 && (
                          <button 
                            onClick={() => navigate('/viewer', { 
                                state: { 
                                    patientName: patient.name, 
                                    folderId: patient.folder_id,
                                    biopsyId: patient.biopsies[0].id 
                                } 
                            })}
                            className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-cyan-600 hover:text-white transition-all flex items-center justify-center gap-2 group-hover:translate-y-0"
                          >
                            <SmartToyIcon fontSize="small" />
                            {patient.biopsies[0].status === "Non analysé" ? "Lancer l'analyse" : "Revoir l'analyse"}
                          </button>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
            </>
        )}
      </div>
    </div>
  );
}