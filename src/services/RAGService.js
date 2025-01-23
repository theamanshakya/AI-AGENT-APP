class RAGService {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async processQuery(agentId, query, token) {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) throw new Error('Failed to process RAG query');
      return await response.json();
    } catch (error) {
      console.error('RAG query error:', error);
      throw error;
    }
  }

  async indexDocument(agentId, document, token) {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/rag/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ document }),
      });

      if (!response.ok) throw new Error('Failed to index document');
      return await response.json();
    } catch (error) {
      console.error('Document indexing error:', error);
      throw error;
    }
  }
}

export default new RAGService(); 