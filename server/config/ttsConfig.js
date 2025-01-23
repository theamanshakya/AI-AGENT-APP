const dotenv = require('dotenv');
dotenv.config();

const ttsConfig = {
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voices: [
      'rachel',
      'adam',
      'antoni',
      'bella',
      'domi',
      'elli',
      'josh',
      'sam'
    ]
  },
  speechify: {
    apiKey: process.env.SPEECHIFY_API_KEY,
    voices: ['matthew', 'jane', 'john', 'mike', 'sarah', 'dave']
  },
  azure: {
    voices: ['alloy', 'ash', 'blue', 'coral', 'echo', 'elder', 'green', 'nova', 'shimmer']
  }
};

const getTTSConfig = () => {
  return {
    getElevenLabsConfig: () => ({
      apiKey: ttsConfig.elevenlabs.apiKey,
      voices: ttsConfig.elevenlabs.voices
    }),
    getSpeechifyConfig: () => ({
      apiKey: ttsConfig.speechify.apiKey,
      voices: ttsConfig.speechify.voices
    }),
    getAzureVoices: () => ttsConfig.azure.voices
  };
};

module.exports = getTTSConfig(); 