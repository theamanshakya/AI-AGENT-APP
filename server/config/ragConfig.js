require('dotenv').config();

module.exports = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: 'text-embedding-3-small',
  completionModel: 'gpt-4-turbo-preview',
  maxTokens: 4000,
  temperature: 0.7,
  vectorDbUrl: process.env.VECTOR_DB_URL || 'postgres://localhost:5432/your_database',
}; 