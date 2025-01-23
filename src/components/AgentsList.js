import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const AgentsList = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await api.getAgents();
        setAgents(data.agents);
      } catch (error) {
        console.error('Error fetching agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="agents-list-container">
      <div className="header">
        <h2>Your AI Voice Agents</h2>
        <Link to="/agents/create" className="btn-primary">
          Create New Agent
        </Link>
      </div>

      <div className="agents-grid">
        {agents.map((agent) => (
          <div key={agent.id} className="agent-card">
            <h3>{agent.name}</h3>
            <p>Domain: {agent.domain}</p>
            <p>Voice: {agent.tts_voice}</p>
            <p>Learning Mode: {agent.learning_mode}</p>
            <div className="card-actions">
              <Link to={`/agents/${agent.id}`} className="btn-secondary">
                View Details
              </Link>
              <Link to={`/agents/${agent.id}/voice-chat`} className="btn-primary">
                Start Chat
              </Link>
            </div>
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="empty-state">
          <p>You haven't created any AI voice agents yet.</p>
          <Link to="/agents/create" className="btn-primary">
            Create Your First Agent
          </Link>
        </div>
      )}
    </div>
  );
};

export default AgentsList; 