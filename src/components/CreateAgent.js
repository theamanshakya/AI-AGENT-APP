import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
// import api from '../services/api';
import config from '../config/config';

const CreateAgent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    tts_provider: '',
    tts_voice: '',
    domain: '',
    learning_mode: 'static',
    system_prompt: '',
  });
  const [voices, setVoices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agentData, setAgentData] = useState(null);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/tts/config`, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
          }
        });
        const data = await response.json();
        setVoices(data.providers);
      } catch (error) {
        console.error('Error fetching voices:', error);
      }
    };

    fetchVoices();
  }, [user.token]);

  useEffect(() => {
    if (id) {
      fetchAgentDetails(id);
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = id 
        ? `${config.apiUrl}/agents/${id}`
        : `${config.apiUrl}/agents`;
      
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error(id ? 'Failed to update agent' : 'Failed to create agent');

      const data = await response.json();
      navigate(`/agents/${data.agent.id}`);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentDetails = async (agentId) => {
    try {
      const response = await fetch(`${config.apiUrl}/agents/${agentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAgentData(data);
      setFormData({
        name: data.name || '',
        tts_provider: data.tts_provider || '',
        tts_voice: data.tts_voice || '',
        domain: data.domain || '',
        learning_mode: data.learning_mode || 'static',
        system_prompt: data.system_prompt || '',
      });
    } catch (error) {
      console.error('Error fetching agent details:', error);
      setError('Failed to load agent details. Please try again later.');
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          setError('Please enter an agent name');
          return false;
        }
        break;
      case 2:
        if (!formData.tts_provider) {
          setError('Please select a TTS provider');
          return false;
        }
        break;
      case 3:
        if (!formData.tts_voice) {
          setError('Please select a voice');
          return false;
        }
        break;
    }
    setError(null);
    return true;
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h3>Step 1: Name Your Agent</h3>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter agent name"
              className="input-field"
            />
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h3>Step 2: Choose TTS Provider</h3>
            <select
              value={formData.tts_provider}
              onChange={(e) => setFormData({ ...formData, tts_provider: e.target.value })}
              className="select-field"
            >
              <option value="">Select Provider</option>
              <option value="azure">Azure</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="speechify">Speechify</option>
            </select>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h3>Step 3: Select Voice</h3>
            <select
              value={formData.tts_voice}
              onChange={(e) => setFormData({ ...formData, tts_voice: e.target.value })}
              className="select-field"
            >
              <option value="">Select Voice</option>
              {voices[formData.tts_provider]?.map((voice) => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h3>Step 4: Configure Knowledge Base</h3>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="Enter domain (e.g., Healthcare, Finance)"
              className="input-field"
            />
            <select
              value={formData.learning_mode}
              onChange={(e) => setFormData({ ...formData, learning_mode: e.target.value })}
              className="select-field"
            >
              <option value="static">Static Knowledge</option>
              <option value="active">Active Learning</option>
            </select>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="Enter system prompt"
              className="textarea-field"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="create-agent-container">
      <h2>Create New AI Voice Agent</h2>
      <div className="progress-bar">
        {[1, 2, 3, 4].map((stepNumber) => (
          <div
            key={stepNumber}
            className={`step ${step >= stepNumber ? 'active' : ''}`}
            onClick={() => setStep(stepNumber)}
          >
            Step {stepNumber}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {renderStep()}

        <div className="navigation-buttons">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="btn-secondary"
            >
              Previous
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary"
              disabled={loading}
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Creating...' : id ? 'Update Agent' : 'Create Agent'}
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '10px 0' }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default CreateAgent; 