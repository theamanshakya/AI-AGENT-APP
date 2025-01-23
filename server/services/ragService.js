const { OpenAI } = require('openai');
const { Pool } = require('pg');
const ragConfig = require('../config/ragConfig');

class RAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: ragConfig.openaiApiKey,
    });

    this.pool = new Pool({
      connectionString: ragConfig.vectorDbUrl,
    });
  }

  async generateEmbedding(text) {
    const response = await this.openai.embeddings.create({
      model: ragConfig.embeddingModel,
      input: text,
    });
    return response.data[0].embedding;
  }

  async indexDocument(agentId, document) {
    const embedding = await this.generateEmbedding(document.content);
    
    try {
      // Try vector type first
      const query = `
        INSERT INTO document_embeddings (agent_id, content, embedding, metadata)
        VALUES ($1, $2, $3::vector, $4)
        RETURNING id
      `;

      const result = await this.pool.query(query, [
        agentId,
        document.content,
        embedding,
        document.metadata || {},
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '42704') { // undefined_object error
        // Fallback to array type
        const query = `
          INSERT INTO document_embeddings (agent_id, content, embedding, metadata)
          VALUES ($1, $2, $3::float8[], $4)
          RETURNING id
        `;

        const result = await this.pool.query(query, [
          agentId,
          document.content,
          embedding,
          document.metadata || {},
        ]);

        return result.rows[0];
      }
      throw error;
    }
  }

  async searchSimilarDocuments(agentId, query, limit = 5) {
    const queryEmbedding = await this.generateEmbedding(query);

    try {
      // Try vector similarity search first
      const searchQuery = `
        SELECT 
          content,
          metadata,
          1 - (embedding <=> $1::vector) as similarity
        FROM document_embeddings
        WHERE agent_id = $2
        ORDER BY similarity DESC
        LIMIT $3
      `;

      const result = await this.pool.query(searchQuery, [
        queryEmbedding,
        agentId,
        limit,
      ]);

      return result.rows;
    } catch (error) {
      if (error.code === '42704') { // undefined_object error
        // Fallback to cosine similarity with array type
        const searchQuery = `
          SELECT 
            content,
            metadata,
            (
              embedding <-> $1::float8[]
            ) as similarity
          FROM document_embeddings
          WHERE agent_id = $2
          ORDER BY similarity ASC
          LIMIT $3
        `;

        const result = await this.pool.query(searchQuery, [
          queryEmbedding,
          agentId,
          limit,
        ]);

        return result.rows;
      }
      throw error;
    }
  }

  async processQuery(agentId, query) {
    const relevantDocs = await this.searchSimilarDocuments(agentId, query);
    
    const context = relevantDocs
      .map(doc => doc.content)
      .join('\n\n');

    const response = await this.openai.chat.completions.create({
      model: ragConfig.completionModel,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Use the provided context to answer questions accurately.',
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`,
        },
      ],
      max_tokens: ragConfig.maxTokens,
      temperature: ragConfig.temperature,
    });

    return {
      answer: response.choices[0].message.content,
      relevantDocs,
    };
  }
}

module.exports = new RAGService(); 