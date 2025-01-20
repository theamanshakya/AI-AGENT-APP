const axios = require('axios');
const ttsConfig = require('../config/ttsConfig');

class TTSService {
  static async synthesizeElevenLabs(text, voiceId) {
    const config = ttsConfig.getElevenLabsConfig();
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      },
      {
        headers: {
          'xi-api-key': config.apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    return response.data;
  }

  static async synthesizeSpeechify(text, voice) {
    const config = ttsConfig.getSpeechifyConfig();
    const response = await axios.post(
      'https://api.speechify.com/v1/tts',
      {
        text,
        voice,
        quality: 'premium'
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    return response.data;
  }
}

module.exports = TTSService; 