import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("Dr. House");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("biopsie_user", username);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-800 to-black">
      <div className="relative w-full max-w-md p-8 bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-cyan-500/10 rounded-full mb-4 animate-pulse"><MedicalServicesIcon className="text-cyan-400" style={{ fontSize: 40 }} /></div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Portail Médecin</h1>
          <p className="text-slate-400 text-sm mt-2">Identification sécurisée</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Identifiant Médecin</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-bold"
              placeholder="Ex: Dr. Wilson"
            />
          </div>          
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Mot de passe</label>
            <input 
              type="password" 
              defaultValue="password"
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>
          <button 
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/20 transition-all transform hover:-translate-y-0.5"
          >Se connecter</button>
        </form>
        <div className="mt-8 text-center text-xs text-slate-500">Système certifié HDS (Hébergeur Données Santé) v2.4</div>
      </div>
    </div>
  );
}