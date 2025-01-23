import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import AgentsList from './components/AgentsList';
import CreateAgent from './components/CreateAgent';
import PrivateRoute from './components/PrivateRoute';
import AudioStreamingApp from './components/AudioStreamingApp';
import KnowledgeBase from './components/KnowledgeBase';
import './styles/components.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
