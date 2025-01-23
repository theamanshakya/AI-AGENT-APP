import config from '../config/config';

class ApiService {
  constructor(baseUrl = config.apiUrl) {
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
      throw new Error(`API call failed: ${response.statusText}`);
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

  async createAgent(agentData) {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
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

    return this.request(`/agents/${agentId}/knowledge/upload`, {
      method: 'POST',
      headers: {
        // Don't set Content-Type here, let the browser set it with the boundary
      },
      body: formData,
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
}

export default new ApiService(); 