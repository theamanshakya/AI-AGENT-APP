const express = require('express');
const cors = require('cors');
const config = require('./config/config');

const app = express();
const PORT = config.getPort();

// Middleware
app.use(cors());
app.use(express.json());

// Config endpoint
app.get('/api/config', (req, res) => {
  try {
    // Only send necessary config to frontend
    res.json({
      endpoint: config.getEndpoint(),
      deploymentModel: config.getDeploymentModel(),
      isAzureOpenAI: config.getIsAzureOpenAI(),
      systemMessage: config.getSystemMessage(),
      temperature: config.getTemperature(),
      voice: config.getVoice()
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
