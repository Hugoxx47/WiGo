import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Viewer from './pages/Viewer';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Route par défaut : Redirige vers le login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Nos pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/viewer" element={<Viewer />} />
      </Routes>
    </Router>
  );
}

export default App;