import React, { useState, useEffect, useRef } from 'react';
import { LowLevelRTClient, SessionUpdateMessage, Voice } from "rt-client";
import { Player } from "./player";
import { Recorder } from "./recorder";
import TTSSelector from './TTSSelector';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import config from '../config/config';

const Message = ({ text, isUser }) => (
  <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
    <div className={`flex items-start max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-500 ml-2' : 'bg-gray-400 mr-2'
      }`}>
        {isUser ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className={`rounded-lg px-4 py-2 ${
        isUser 
          ? 'bg-blue-500 text-white rounded-br-none' 
          : 'bg-gray-100 text-gray-800 rounded-bl-none'
      }`}>
        <p className="text-sm whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  </div>
);

const AudioStreamingApp = () => {
  const { agentId } = useParams();
  const { user } = useAuth();
  const [inputState, setInputState] = useState('readyToStart');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');  // We'll get this from backend securely
  const [deploymentOrModel, setDeploymentOrModel] = useState('');
  const [isAzureOpenAI, setIsAzureOpenAI] = useState(true);
  const [systemMessage, setSystemMessage] = useState('');
  const [temperature, setTemperature] = useState('0.8');
  const [voice, setVoice] = useState('');
  const [receivedText, setReceivedText] = useState([]);
  const [ttsProvider, setTTSProvider] = useState('azure');
  const [availableVoices, setAvailableVoices] = useState({
    azure: [],
    elevenlabs: [],
    speechify: []
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentConfig, setAgentConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const realtimeStreamingRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const recordingActiveRef = useRef(false);
  const bufferRef = useRef(new Uint8Array());
  const latestInputSpeechBlockRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const voices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];

  // Fetch config from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/config');
        const config = await response.json();
        setApiKey(config.apiKey);
        setEndpoint(config.endpoint);
        setDeploymentOrModel(config.deploymentModel);
        setIsAzureOpenAI(config.isAzureOpenAI);
        setSystemMessage(config.systemMessage);
        setTemperature(config.temperature.toString());
      } catch (error) {
        console.error('Error fetching config:', error);
        appendText("[Error]: Unable to fetch configuration from server");
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    guessIfIsAzureOpenAI();
  }, [endpoint]);

  const guessIfIsAzureOpenAI = () => {
    setIsAzureOpenAI(endpoint.trim().indexOf('azure') > -1);
  };

  // Fetch TTS configuration
  useEffect(() => {
    const fetchTTSConfig = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/tts/config');
        const data = await response.json();
        setAvailableVoices(data.providers);
      } catch (error) {
        console.error('Error fetching TTS config:', error);
      }
    };
    fetchTTSConfig();
  }, []);

  // Fetch agent configuration on component mount
  useEffect(() => {
    const fetchAgentConfig = async () => {
      try {
        const response = await fetch(`${config.apiUrl}/agents/${agentId}`, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch agent configuration');
        }

        const data = await response.json();
        setAgentConfig(data);
        // Set initial TTS configuration based on agent settings
        setTTSProvider(data.tts_provider);
        setVoice(data.tts_voice);
      } catch (error) {
        console.error('Error fetching agent config:', error);
        setError('Failed to load agent configuration');
      }
    };

    fetchAgentConfig();
  }, [agentId, user.token]);

  const createConfigMessage = () => {
    let configMessage = {
      type: "session.update",
      session: {
        turn_detection: {
          type: "server_vad",
        },
        input_audio_transcription: {
          model: "whisper-1"
        },
        // Add voice configuration directly in the session
        voice: voice,
        tts: {
          provider: ttsProvider,
          voice: voice
        }
      }
    };

    if (systemMessage) {
      configMessage.session.instructions = systemMessage;
    }
    if (!isNaN(parseFloat(temperature))) {
      configMessage.session.temperature = parseFloat(temperature);
    }

    return configMessage;
  };

  // Update the voice change handler
  const handleVoiceChange = (newVoice) => {
    setVoice(newVoice);
    if (realtimeStreamingRef.current) {
      // Send both session update and tts update
      realtimeStreamingRef.current.send({
        type: "session.update",
        session: {
          voice: newVoice,
          tts: {
            provider: ttsProvider,
            voice: newVoice
          }
        }
      });
    }
  };

  // Add this useEffect to handle voice/provider changes
  useEffect(() => {
    if (realtimeStreamingRef.current && inputState === 'readyToStop' && voice) {
      realtimeStreamingRef.current.send({
        type: "session.update",
        session: {
          voice: voice,
          tts: {
            provider: ttsProvider,
            voice: voice
          }
        }
      });
    }
  }, [voice, ttsProvider, inputState]);

  const processAudioRecordingBuffer = (data) => {
    const uint8Array = new Uint8Array(data);
    const newBuffer = new Uint8Array(bufferRef.current.length + uint8Array.length);
    newBuffer.set(bufferRef.current);
    newBuffer.set(uint8Array, bufferRef.current.length);
    bufferRef.current = newBuffer;

    if (bufferRef.current.length >= 4800) {
      const toSend = new Uint8Array(bufferRef.current.slice(0, 4800));
      bufferRef.current = new Uint8Array(bufferRef.current.slice(4800));
      const regularArray = String.fromCharCode(...toSend);
      const base64 = btoa(regularArray);

      if (recordingActiveRef.current) {
        realtimeStreamingRef.current.send({
          type: "input_audio_buffer.append",
          audio: base64,
        });
      }
    }
  };

  const resetAudio = async (startRecording) => {
    recordingActiveRef.current = false;
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.clear();
    }

    audioRecorderRef.current = new Recorder(processAudioRecordingBuffer);
    audioPlayerRef.current = new Player();
    await audioPlayerRef.current.init(24000);

    if (startRecording) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRecorderRef.current.start(stream);
      recordingActiveRef.current = true;
    }
  };

  const handleRealtimeMessages = async () => {
    for await (const message of realtimeStreamingRef.current.messages()) {
      let consoleLog = "" + message.type;
      console.log(consoleLog);
      switch (message.type) {
        case "session.created":
          setInputState('readyToStop');
          const greeting = "Hello! I'm your AI assistant. How can I help you today?";
          appendText(greeting);
          if (realtimeStreamingRef.current) {
            // Send initial voice configuration with greeting
            realtimeStreamingRef.current.send({
              type: "text.generate",
              text: greeting,
              voice: voice,
              provider: ttsProvider
            });
          }
          break;
        case "response.audio_transcript.delta":
          appendToLastText(message.delta);
          break;
        case "response.audio.delta":
          const binary = atob(message.delta);
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          const pcmData = new Int16Array(bytes.buffer);
          audioPlayerRef.current.play(pcmData);
          break;
        case "input_audio_buffer.speech_started":
          latestInputSpeechBlockRef.current = receivedText.length;
          audioPlayerRef.current.clear();
          break;
        case "conversation.item.input_audio_transcription.completed":
          appendText(`User: ${message.transcript}`);
          appendText("AI: ");
          break;
        case "response.done":
          appendText("");
          break;
        default:
          consoleLog = JSON.stringify(message, null, 2);
      }

      if (consoleLog) {
        console.log(consoleLog);
      }
    }
    resetAudio(false);
  };

  const startRealtime = async () => {
    setInputState('working');
    setReceivedText([]);

    if (isAzureOpenAI && (!endpoint || !deploymentOrModel)) {
      setInputState('readyToStart');
      return;
    }

    if (!isAzureOpenAI && !deploymentOrModel) {
      setInputState('readyToStart');
      return;
    }

    if (!apiKey) {
      setInputState('readyToStart');
      return;
    }

    try {
      if (isAzureOpenAI) {
        realtimeStreamingRef.current = new LowLevelRTClient(
          new URL(endpoint),
          { key: apiKey },
          { 
            deployment: deploymentOrModel,
            voice: voice,  // Add voice to initial configuration
            provider: ttsProvider
          }
        );
      } else {
        realtimeStreamingRef.current = new LowLevelRTClient(
          { key: apiKey },
          { 
            model: deploymentOrModel,
            voice: voice,  // Add voice to initial configuration
            provider: ttsProvider
          }
        );
      }

      // Send initial configuration
      await realtimeStreamingRef.current.send(createConfigMessage());
      await Promise.all([resetAudio(true), handleRealtimeMessages()]);
    } catch (error) {
      console.error(error);
      appendText("[Connection error]: Unable to send initial config message. Please check your endpoint and authentication details.");
      setInputState('readyToStart');
    }
  };

  const stopRealtime = async () => {
    setInputState('working');
    await resetAudio(false);
    // Save conversation to file
    const conversationText = receivedText.join('\n');
    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversation-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    realtimeStreamingRef.current.close();
    setInputState('readyToStart');
  };

  const appendText = (text) => {
    setReceivedText(prev => [...prev, text]);
  };

  const appendToLastText = (text) => {
    setReceivedText(prev => {
      const newTexts = [...prev];
      if (newTexts.length === 0) {
        newTexts.push(text);
      } else {
        newTexts[newTexts.length - 1] += text;
      }
      return newTexts;
    });
  };

  const updateText = (index, updateFn) => {
    setReceivedText(prev => {
      const newTexts = [...prev];
      newTexts[index] = updateFn(newTexts[index]);
      return newTexts;
    });
  };

  const clearAll = () => {
    setReceivedText([]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudioInput(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudioInput = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('agentId', agentId);

    try {
      // Send audio to speech-to-text
      const sttResponse = await fetch(`${config.apiUrl}/stt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!sttResponse.ok) throw new Error('STT processing failed');
      
      const { text } = await sttResponse.json();
      setTranscript(text);

      // Get AI response
      const aiResponse = await fetch(`${config.apiUrl}/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (!aiResponse.ok) throw new Error('AI processing failed');
      
      const { response } = await aiResponse.json();

      // Convert AI response to speech
      const ttsResponse = await fetch(`${config.apiUrl}/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          text: response,
          provider: agentConfig.tts_provider,
          voice: agentConfig.tts_voice,
        }),
      });

      if (!ttsResponse.ok) throw new Error('TTS processing failed');

      const audioBlob = await ttsResponse.blob();
      playAudioResponse(audioBlob);
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  };

  const playAudioResponse = (audioBlob) => {
    const audio = new Audio(URL.createObjectURL(audioBlob));
    setIsPlaying(true);
    
    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.play();
  };

  // Function to handle conversation turns
  const handleConversationTurn = async (userMessage) => {
    try {
      // Add user message to conversation
      const newMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);

      // Send message to backend for processing
      const response = await fetch(`${config.apiUrl}/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: messages,
          system_prompt: agentConfig.system_prompt
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get agent response');
      }

      const { response: aiResponse } = await response.json();

      // Add AI response to conversation
      const aiMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);

      // Convert AI response to speech
      await synthesizeSpeech(aiResponse);

      // Save conversation for training
      await saveConversationTurn(newMessage, aiMessage);

    } catch (error) {
      console.error('Error in conversation:', error);
      setError('Failed to process conversation');
    }
  };

  // Function to save conversation turns for training
  const saveConversationTurn = async (userMessage, aiMessage) => {
    try {
      await fetch(`${config.apiUrl}/agents/${agentId}/training`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          user_message: userMessage,
          ai_message: aiMessage,
          domain: agentConfig.domain,
          learning_mode: agentConfig.learning_mode
        }),
      });
    } catch (error) {
      console.error('Error saving conversation for training:', error);
    }
  };

  // Function to synthesize speech from text
  const synthesizeSpeech = async (text) => {
    try {
      setIsPlaying(true);
      const response = await fetch(`${config.apiUrl}/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          text,
          provider: agentConfig.tts_provider,
          voice: agentConfig.tts_voice,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS synthesis failed');
      }

      const audioBlob = await response.blob();
      const audio = new Audio(URL.createObjectURL(audioBlob));
      
      audio.onended = () => {
        setIsPlaying(false);
      };

      await audio.play();
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      setIsPlaying(false);
      setError('Failed to synthesize speech');
    }
  };

  return (
    <div className="w-5/6 mx-auto bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {agentConfig ? (
        <div className="p-4">
          <div className="mb-4 bg-white rounded-lg p-4 shadow">
            <h2 className="text-xl font-bold">{agentConfig.name}</h2>
            <p className="text-gray-600">Domain: {agentConfig.domain}</p>
            <p className="text-gray-600">Learning Mode: {agentConfig.learning_mode}</p>
          </div>

          {/* Conversation Interface */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="h-[500px] overflow-y-auto mb-4">
              {messages.map((message, index) => (
                <Message
                  key={index}
                  text={message.content}
                  isUser={message.role === 'user'}
                />
              ))}
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isPlaying}
                className={`px-4 py-2 rounded-lg ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white`}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">{error}</div>
      ) : (
        <div className="p-4">Loading agent configuration...</div>
      )}
    </div>
  );
};

export default AudioStreamingApp;