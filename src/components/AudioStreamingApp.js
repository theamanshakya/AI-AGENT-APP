import React, { useState, useEffect, useRef } from 'react';
import { LowLevelRTClient, SessionUpdateMessage, Voice } from "rt-client";
import { Player } from "./player";
import { Recorder } from "./recorder";

const AudioStreamingApp = () => {
  const [inputState, setInputState] = useState('readyToStart');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey] = useState('');  // We'll get this from backend securely
  const [deploymentOrModel, setDeploymentOrModel] = useState('');
  const [isAzureOpenAI, setIsAzureOpenAI] = useState(true);
  const [systemMessage, setSystemMessage] = useState('');
  const [temperature, setTemperature] = useState('0.8');
  const [voice, setVoice] = useState('alloy');
  const [receivedText, setReceivedText] = useState([]);

  const realtimeStreamingRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const recordingActiveRef = useRef(false);
  const bufferRef = useRef(new Uint8Array());
  const latestInputSpeechBlockRef = useRef(null);

  const voices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];

  // Fetch config from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/config');
        const config = await response.json();
        
        setEndpoint(config.endpoint);
        setDeploymentOrModel(config.deploymentModel);
        setIsAzureOpenAI(config.isAzureOpenAI);
        setSystemMessage(config.systemMessage);
        setTemperature(config.temperature.toString());
        setVoice(config.voice);
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

  const createConfigMessage = () => {
    let configMessage = {
      type: "session.update",
      session: {
        turn_detection: {
          type: "server_vad",
        },
        input_audio_transcription: {
          model: "whisper-1"
        }
      }
    };

    if (systemMessage) {
      configMessage.session.instructions = systemMessage;
    }
    if (!isNaN(parseFloat(temperature))) {
      configMessage.session.temperature = parseFloat(temperature);
    }
    if (voice) {
      configMessage.session.voice = voice;
    }

    return configMessage;
  };

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
          updateText(latestInputSpeechBlockRef.current,
            prev => prev + " User: " + message.transcript);
          appendText("");
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
          { deployment: deploymentOrModel }
        );
      } else {
        realtimeStreamingRef.current = new LowLevelRTClient(
          { key: apiKey },
          { model: deploymentOrModel }
        );
      }

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

  return (
    <div className="w-5/6 mx-auto bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
        <div className="space-y-6">
          {/* Control Buttons */}
          <div className="flex justify-center space-x-6">
            <button
              type="button"
              onClick={startRealtime}
              disabled={inputState !== 'readyToStart'}
              className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transform hover:scale-105 transition-all duration-200 font-semibold"
            >
              <span className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Start</span>
              </span>
            </button>
            <button
              type="button"
              onClick={stopRealtime}
              disabled={inputState !== 'readyToStop'}
              className="px-6 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transform hover:scale-105 transition-all duration-200 font-semibold"
            >
              <span className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span>Stop</span>
              </span>
            </button>
          </div>

          {/* Conversation Display */}
          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Conversation</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {receivedText.map((text, index) => (
                <p key={index} className="whitespace-pre-wrap p-4 bg-gray-50 rounded-lg text-gray-700">{text}</p>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={clearAll}
              className="px-6 py-3 text-white bg-gray-600 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transform hover:scale-105 transition-all duration-200 font-semibold"
            >
              <span className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Clear all</span>
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AudioStreamingApp;