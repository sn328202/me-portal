import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppShell from './layout/AppShell';
import Dashboard from './pages/Dashboard';
import Learning from './pages/Learning';
import Play from './pages/Play';
import Systems from './pages/Systems';
import Atlas from './pages/Atlas';
import Settings from './pages/Settings';
import Larder from './pages/Larder';
import Treasury from './pages/Treasury';
import Library from './pages/Library';
import Studio from './pages/Studio';
import DayPlanner from './pages/DayPlanner';
import Auth from './pages/Auth';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoadingScreen from './components/LoadingScreen';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/larder" element={<Larder />} />
                    <Route path="/treasury" element={<Treasury />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/atlas" element={<Atlas />} />
                    <Route path="/daydream" element={<DayPlanner />} />
                    <Route path="/study" element={<Studio />} />
                    <Route path="/learning" element={<Learning />} />
                    <Route path="/play" element={<Play />} />
                    <Route path="/systems" element={<Systems />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </AppShell>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
