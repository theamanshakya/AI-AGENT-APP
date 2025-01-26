const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config();

const ttsConfig = {
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voices: []
  },
  speechify: {
    apiKey: process.env.SPEECHIFY_API_KEY,
    voices: []
  },
  azure: {
    voices: []
  }
};

const getTTSConfig = () => {
  // Fetch ElevenLabs voices
  const fetchElevenLabsVoices = async () => {
    try {
      const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': ttsConfig.elevenlabs.apiKey
        }
      });
      ttsConfig.elevenlabs.voices = response.data.voices.map(voice => ({
        id: voice.voice_id,
        name: voice.name
      }));
      // console.log(ttsConfig.elevenlabs.voices);
      
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
    }
  };

  // Fetch Speechify voices
  const fetchSpeechifyVoices = async () => {
    try {
      const response = await axios.get('https://api.sws.speechify.com/v1/voices', {
        headers: {
          'Authorization': `Bearer ${ttsConfig.speechify.apiKey}`
        }
      });
      ttsConfig.speechify.voices = response.data.map(voice => ({
        id: voice.id,
        name: voice.display_name
      }));
    } catch (error) {
      console.error('Error fetching Speechify voices:', error);
    }
  };

  // Fetch Azure voices
  const fetchAzureVoices = async () => {
    try {
      const response = await axios.get(
        'https://eastus.tts.speech.microsoft.com/cognitiveservices/voices/list',
        {
          headers: {
            'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY
          }
        }
      );
      // console.log(response.data);
      ttsConfig.azure.voices = response.data.map(voice => ({
        id: voice.ShortName,
        name: voice.DisplayName
      }));
    } catch (error) {
      console.error('Error fetching Azure voices:', error);
    }
  };

  // Initialize voice lists
  fetchElevenLabsVoices();
  fetchSpeechifyVoices();
  fetchAzureVoices();

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