import React, { useEffect } from 'react';

const TTSSelector = ({ provider, setProvider, voice, setVoice, voices, loading }) => {
  const availableVoices = voices[provider] || [];

  // Set initial voice when component mounts or when provider/voices change
  useEffect(() => {
    if (availableVoices.length > 0 && !voice) {
      setVoice(availableVoices[0]);
    }
  }, [provider, voices, voice, setVoice, availableVoices]);

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    // Set first available voice when provider changes
    if (voices[newProvider]?.length > 0) {
      setVoice(voices[newProvider][0]);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          TTS Provider
        </label>
        <select
          value={provider}
          onChange={handleProviderChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          disabled={loading}
        >
          <option value="azure">Azure TTS</option>
          <option value="elevenlabs">ElevenLabs</option>
          <option value="speechify">Speechify</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Voice
        </label>
        <select
          value={voice || ''}  
          onChange={(e) => setVoice(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          disabled={loading || availableVoices.length === 0}
        >
          {availableVoices.length === 0 && (
            <option value="">No voices available</option>
          )}
          {availableVoices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TTSSelector; 