import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Viewer from './pages/Viewer';
import Login from './pages/Login';
import UserTaskList from './pages/UserTaskList';
import WorkflowBuilder from './pages/WorkflowBuilder';

const getCurrentUser = () => {
  const raw = localStorage.getItem('biopsie_user');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { id: number; name: string; role: string };
    if (parsed?.name && parsed?.role) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
};

function App() {
  const currentUser = getCurrentUser();
  const isAuthenticated = Boolean(currentUser);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans antialiased selection:bg-cyan-500 selection:text-white">
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/inbox" element={isAuthenticated ? <UserTaskList /> : <Navigate to="/login" />} />
          <Route path="/admin/workflows" element={isAuthenticated && isAdmin ? <WorkflowBuilder /> : <Navigate to="/inbox" />} />
          <Route path="/viewer" element={isAuthenticated ? <Viewer /> : <Navigate to="/login" />}/>
          <Route path="*" element={<Navigate to={isAuthenticated ? '/inbox' : '/login'} />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;