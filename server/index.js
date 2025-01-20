const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const ttsConfig = require('./config/ttsConfig');
const TTSService = require('./services/ttsService');

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
