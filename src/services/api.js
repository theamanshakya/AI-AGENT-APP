import config from '../config/config';

class ApiService {
  constructor(baseUrl = config.apiUrl) {
    console.log(baseUrl);
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      // Get the error details from response if possible
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `API call failed: ${response.statusText}`);
      } catch (e) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
    }

    return response.json();
  }

  // Auth endpoints
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Agents endpoints
  async getAgents() {
    return this.request('/agents');
  }

  async getAgentById(id) {
    return this.request(`/agents/${id}`);
  }

  async createAgent(agentData) {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(id, agentData) {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agentData),
    });
  }

  async deleteAgent(id) {
    return this.request(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  // Knowledge base endpoints
  async addKnowledge(agentId, content, metadata = {}) {
    return this.request(`/agents/${agentId}/knowledge`, {
      method: 'POST',
      body: JSON.stringify({ content, metadata }),
    });
  }

  async uploadDocument(agentId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    return fetch(`${this.baseUrl}/agents/${agentId}/knowledge/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }).then(response => {
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    });
  }

  // Conversation endpoints
  async startConversation(agentId) {
    return this.request(`/agents/${agentId}/conversations`, {
      method: 'POST',
    });
  }

  async sendMessage(conversationId, content) {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role: 'user', content }),
    });
  }

  // TTS endpoints
  async getTTSConfig() {
    return this.request('/tts/config');
  }

  async synthesizeSpeech(text, provider, voice) {
    return this.request('/tts/synthesize', {
      method: 'POST',
      body: JSON.stringify({ text, provider, voice }),
    });
  }

  // Training endpoints
  async saveTrainingData(agentId, trainingData) {
    return this.request(`/agents/${agentId}/training`, {
      method: 'POST',
      body: JSON.stringify(trainingData),
    });
  }

  // Chat endpoints
  async sendChatMessage(agentId, message, conversationHistory = []) {
    return this.request(`/agents/${agentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory
      }),
    });
  }

  // Config endpoint
  async getConfig() {
    return this.request('/config');
  }
}

export default new ApiService(); 