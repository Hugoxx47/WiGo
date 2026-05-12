import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Viewer from './pages/Viewer';
import Login from './pages/Login';
import RadiologyViewer from './pages/RadiologyViewer';

// Pour la démo, on simule que l'utilisateur est connecté
const isAuthenticated = true;

function App() {
  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans antialiased selection:bg-cyan-500 selection:text-white">
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/viewer" element={isAuthenticated ? <Viewer /> : <Navigate to="/login" />}/>
          <Route path="/radiology" element={isAuthenticated ? <RadiologyViewer /> : <Navigate to="/login" />}/>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;