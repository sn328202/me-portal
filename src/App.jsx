import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppShell from './layout/AppShell';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { CaptureProvider } from './contexts/CaptureContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';

// Every route except the landing Dashboard is code-split. The three heaviest
// carry dependencies nothing else needs: Larder -> emoji-picker-react,
// Atlas -> leaflet, Daydream -> google-maps + dnd-kit.
const Atlas = lazy(() => import('./pages/Atlas'));
const DayBuilder = lazy(() => import('./pages/DayBuilder'));
const Larder = lazy(() => import('./pages/Larder'));
const Treasury = lazy(() => import('./pages/Treasury'));
const Library = lazy(() => import('./pages/Library'));
const Studio = lazy(() => import('./pages/Studio'));
const Learning = lazy(() => import('./pages/Learning'));
const Play = lazy(() => import('./pages/Play'));
const Systems = lazy(() => import('./pages/Systems'));
const Wardrobe = lazy(() => import('./pages/Wardrobe'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

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
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <CaptureProvider>
          <ThemeProvider>
            <Router>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <AppShell>
                      <ErrorBoundary>
                        <Suspense fallback={<LoadingScreen />}>
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/larder" element={<Larder />} />
                            <Route path="/treasury" element={<Treasury />} />
                            <Route path="/library" element={<Library />} />
                            <Route path="/atlas" element={<Atlas />} />
                            {/* A day is built on its own page, with its own
                                address. Not a modal: this is where ten minutes
                                go at a stretch, and a drag-and-drop board
                                inside a scrolling dialog inside a scrolling
                                page is what froze the timeline last week. */}
                            <Route path="/atlas/:tripId/day/:date" element={<DayBuilder />} />
                            {/* The Daydream is gone — a day is a one-day trip
                                and the Atlas is the only room. Every address
                                it used to answer still resolves, because a
                                bookmark is a promise even when the thing it
                                pointed at has been retired. */}
                            <Route path="/daydream" element={<Navigate to="/atlas" replace />} />
                            <Route path="/commonplace" element={<Navigate to="/atlas" replace />} />
                            <Route
                                path="/tablebook"
                                element={<Navigate to="/atlas?tab=table" replace />}
                            />
                            <Route path="/study" element={<Studio />} />
                            <Route path="/learning" element={<Learning />} />
                            <Route path="/play" element={<Play />} />
                            <Route path="/systems" element={<Systems />} />
                            <Route path="/wardrobe" element={<Wardrobe />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </ErrorBoundary>
                    </AppShell>
                  </ProtectedRoute>
                } />
              </Routes>
            </Router>
          </ThemeProvider>
          </CaptureProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
