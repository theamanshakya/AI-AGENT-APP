import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Login from './components/Login';
import Register from './components/Register';
import AgentsList from './components/AgentsList';
import CreateAgent from './components/CreateAgent';
import PrivateRoute from './components/PrivateRoute';
import AudioStreamingApp from './components/AudioStreamingApp';
import KnowledgeBase from './components/KnowledgeBase';
import './styles/components.css';

const PrivateLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Private Routes */}
          <Route element={<PrivateLayout />}>
            <Route
              path="/agents"
              element={
                <PrivateRoute>
                  <AgentsList />
                </PrivateRoute>
              }
            />
            <Route
              path="/agents/create"
              element={
                <PrivateRoute>
                  <CreateAgent />
                </PrivateRoute>
              }
            />
            <Route
              path="/agents/:id"
              element={
                <PrivateRoute>
                  <CreateAgent />
                </PrivateRoute>
              }
            />
            <Route
              path="/agents/:agentId/voice-chat"
              element={
                <PrivateRoute>
                  <AudioStreamingApp />
                </PrivateRoute>
              }
            />
            <Route
              path="/agents/:agentId/knowledge"
              element={
                <PrivateRoute>
                  <KnowledgeBase />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/agents" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
