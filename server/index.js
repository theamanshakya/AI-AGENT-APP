const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const config = require('./config/config');
const ttsConfig = require('./config/ttsConfig');
const TTSService = require('./services/ttsService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const ragService = require('./services/ragService');
const multer = require('multer');

const app = express();
const PORT = config.getPort();

// Create PostgreSQL connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'your_database_name',
  password: process.env.POSTGRES_PASSWORD || 'your_password',
  port: process.env.POSTGRES_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Successfully connected to PostgreSQL database');
  release();
});

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // unique violation
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create AI Agent
app.post('/api/agents', authenticateToken, async (req, res) => {
  try {
    const { name, tts_provider, tts_voice, domain, learning_mode, system_prompt } = req.body;
    
    const result = await pool.query(
      `INSERT INTO ai_agents 
       (user_id, name, tts_provider, tts_voice, domain, learning_mode, system_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, name, tts_provider, tts_voice, domain, learning_mode, system_prompt]
    );
    
    res.status(201).json({ agent: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create AI agent' });
  }
});

// Get user's AI Agents
app.get('/api/agents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ai_agents WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ agents: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AI agents' });
  }
});

// Add knowledge to agent
app.post('/api/agents/:agentId/knowledge', authenticateToken, async (req, res) => {
  try {
    const { content, metadata } = req.body;
    const agentId = req.params.agentId;
    
    // Verify agent ownership
    const agentCheck = await pool.query(
      'SELECT id FROM ai_agents WHERE id = $1 AND user_id = $2',
      [agentId, req.user.id]
    );
    
    if (agentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const result = await pool.query(
      'INSERT INTO knowledge_base (agent_id, content, metadata) VALUES ($1, $2, $3) RETURNING *',
      [agentId, content, metadata]
    );
    
    res.status(201).json({ knowledge: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add knowledge' });
  }
});

// Start conversation
app.post('/api/agents/:agentId/conversations', authenticateToken, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    const result = await pool.query(
      'INSERT INTO conversations (agent_id, user_id) VALUES ($1, $2) RETURNING *',
      [agentId, req.user.id]
    );
    
    res.status(201).json({ conversation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// Add message to conversation
app.post('/api/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { role, content } = req.body;
    const conversationId = req.params.conversationId;
    
    const result = await pool.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [conversationId, role, content]
    );
    
    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Config endpoint
app.get('/api/config', (req, res) => {
  try {
    // Only send necessary config to frontend
    res.json({
      apiKey: config.getApiKey(),
      endpoint: config.getEndpoint(),
      deploymentModel: config.getDeploymentModel(),
      isAzureOpenAI: config.getIsAzureOpenAI(),
      systemMessage: config.getSystemMessage(),
      temperature: config.getTemperature(),
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Audio streaming endpoint
app.post('/api/stream', (req, res) => {
  try {
    // Handle audio stream data
    res.json({ success: true, message: 'Audio stream received' });
  } catch (error) {
    console.error('Error processing audio stream:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/tts/config', (req, res) => {
  try {
    res.json({
      providers: {
        azure: ttsConfig.getAzureVoices(),
        elevenlabs: ttsConfig.getElevenLabsConfig().voices,
        speechify: ttsConfig.getSpeechifyConfig().voices
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch TTS configuration' });
  }
});

app.post('/api/tts/synthesize', async (req, res) => {
  try {
    const { text, provider, voice } = req.body;
    let audioData;

    switch (provider) {
      case 'elevenlabs':
        audioData = await TTSService.synthesizeElevenLabs(text, voice);
        break;
      case 'speechify':
        audioData = await TTSService.synthesizeSpeechify(text, voice);
        break;
      default:
        return res.status(400).json({ error: 'Invalid TTS provider' });
    }

    res.send(audioData);
  } catch (error) {
    res.status(500).json({ error: 'TTS synthesis failed' });
  }
});

// Example database query endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, timestamp: result.rows[0].now });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ success: false, error: 'Database query failed' });
  }
});

// RAG endpoints
app.post('/api/agents/:agentId/rag/index', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const document = req.body;

    // Verify agent ownership
    const agentQuery = await pool.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND user_id = $2',
      [agentId, req.user.id]
    );

    if (agentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const result = await ragService.indexDocument(agentId, document);
    res.json({ success: true, document: result });
  } catch (error) {
    console.error('Error indexing document:', error);
    res.status(500).json({ error: 'Failed to index document' });
  }
});

app.post('/api/agents/:agentId/rag/query', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { query } = req.body;

    // Verify agent ownership
    const agentQuery = await pool.query(
      'SELECT * FROM ai_agents WHERE id = $1 AND user_id = $2',
      [agentId, req.user.id]
    );

    if (agentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const result = await ragService.processQuery(agentId, query);
    res.json(result);
  } catch (error) {
    console.error('Error processing RAG query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

// File upload endpoint for document indexing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

app.post('/api/agents/:agentId/knowledge/upload', 
  authenticateToken, 
  upload.single('file'), 
  async (req, res) => {
    try {
      const { agentId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Convert file buffer to text
      const content = file.buffer.toString('utf-8');

      // Index the document
      const document = {
        content,
        metadata: {
          filename: file.originalname,
          mimetype: file.mimetype,
        },
      };

      const result = await ragService.indexDocument(agentId, document);
      res.json({ success: true, document: result });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

// Modified error handling middleware to handle database errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code && err.code.startsWith('23')) {
    // PostgreSQL error codes starting with 23 are integrity constraint violations
    res.status(400).json({ success: false, error: 'Invalid data provided' });
  } else {
    res.status(500).json({ success: false, error: 'Something went wrong!' });
  }
});

// Get specific AI Agent details
app.get('/api/agents/:id', authenticateToken, async (req, res) => {
  try {
    const agentId = req.params.id;
    
    // Query that joins with knowledge_base to get the agent's knowledge as well
    const result = await pool.query(
      `SELECT 
        a.*,
        json_agg(DISTINCT k.*) FILTER (WHERE k.id IS NOT NULL) as knowledge
       FROM ai_agents a
       LEFT JOIN knowledge_base k ON k.agent_id = a.id
       WHERE a.id = $1 AND a.user_id = $2
       GROUP BY a.id`,
      [agentId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching agent details:', error);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

// Update AI Agent
app.put('/api/agents/:id', authenticateToken, async (req, res) => {
  try {
    const agentId = req.params.id;
    const { name, tts_provider, tts_voice, domain, learning_mode, system_prompt } = req.body;

    // First verify that the agent belongs to the user
    const checkOwnership = await pool.query(
      'SELECT id FROM ai_agents WHERE id = $1 AND user_id = $2',
      [agentId, req.user.id]
    );

    if (checkOwnership.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Update the agent
    const result = await pool.query(
      `UPDATE ai_agents 
       SET name = $1, 
           tts_provider = $2, 
           tts_voice = $3, 
           domain = $4, 
           learning_mode = $5, 
           system_prompt = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [name, tts_provider, tts_voice, domain, learning_mode, system_prompt, agentId, req.user.id]
    );

    res.json({ agent: result.rows[0] });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Delete AI Agent
app.delete('/api/agents/:id', authenticateToken, async (req, res) => {
  try {
    const agentId = req.params.id;

    // First verify that the agent belongs to the user
    const checkOwnership = await pool.query(
      'SELECT id FROM ai_agents WHERE id = $1 AND user_id = $2',
      [agentId, req.user.id]
    );

    if (checkOwnership.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Delete the agent and all related data
    await pool.query('BEGIN');

    // Delete knowledge base entries
    await pool.query('DELETE FROM knowledge_base WHERE agent_id = $1', [agentId]);
    
    // Delete document embeddings
    await pool.query('DELETE FROM document_embeddings WHERE agent_id = $1', [agentId]);
    
    // Delete messages from conversations
    await pool.query(
      'DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE agent_id = $1)',
      [agentId]
    );
    
    // Delete conversations
    await pool.query('DELETE FROM conversations WHERE agent_id = $1', [agentId]);
    
    // Finally delete the agent
    await pool.query('DELETE FROM ai_agents WHERE id = $1 AND user_id = $2', [agentId, req.user.id]);

    await pool.query('COMMIT');

    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Add training data endpoint
app.post('/api/agents/:agentId/training', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { user_message, ai_message, domain, learning_mode } = req.body;

    // Verify agent ownership
    const agentCheck = await pool.query(
      'SELECT id FROM ai_agents WHERE id = $1 AND user_id = $2',
      [agentId, req.user.id]
    );

    if (agentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Save conversation turn to training data
    const result = await pool.query(
      `INSERT INTO training_data 
       (agent_id, user_message, ai_message, domain, learning_mode, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [agentId, user_message, ai_message, domain, learning_mode]
    );

    res.status(201).json({ training_data: result.rows[0] });
  } catch (error) {
    console.error('Error saving training data:', error);
    res.status(500).json({ error: 'Failed to save training data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
