import React, { useState, useEffect, useRef } from 'react';
import { LowLevelRTClient } from "rt-client";
import { Player } from "./player";
import { Recorder } from "./recorder";

const AudioStreamingApp = () => {
  const [inputState, setInputState] = useState('readyToStart');
  const [receivedText, setReceivedText] = useState([]);

  // Configuration - Move sensitive data to environment variables
  const ENDPOINT = process.env.REACT_APP_AZURE_ENDPOINT || 'https://ai-talibahmed0504ai310861974661.openai.azure.com/';
  const API_KEY = process.env.REACT_APP_AZURE_API_KEY || 'Bd7U6uErjmvDNutguAD8K0xKUxIH9ZMWG8ssd3gOWyreprDy2vEPJQQJ99ALACHYHv6XJ3w3AAAAACOG7qA2';
  const DEPLOYMENT_MODEL = process.env.REACT_APP_DEPLOYMENT_MODEL || 'gpt-4o-realtime-preview';

  const realtimeStreamingRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const recordingActiveRef = useRef(false);
  const bufferRef = useRef(new Uint8Array());
  const latestInputSpeechBlockRef = useRef(null);

  const createConfigMessage = () => ({
    type: "session.update",
    session: {
      turn_detection: { type: "server_vad" },
      input_audio_transcription: { model: "whisper-1" },
      instructions: "You are a helpful AI assistant.",
      temperature: 0.8,
      voice: "alloy"
    }
  });

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

      if (recordingActiveRef.current && realtimeStreamingRef.current) {
        realtimeStreamingRef.current.send({
          type: "input_audio_buffer.append",
          audio: base64,
        });
      }
    }
  };

  const resetAudio = async (startRecording) => {
    try {
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
    } catch (error) {
      console.error("Audio reset error:", error);
      setInputState('readyToStart');
    }
  };

  const handleRealtimeMessages = async () => {
    try {
      for await (const message of realtimeStreamingRef.current.messages()) {
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
        }
      }
    } catch (error) {
      console.error("Realtime messaging error:", error);
    } finally {
      await resetAudio(false);
    }
  };

  const startRealtime = async () => {
    setInputState('working');

    if (!ENDPOINT || !DEPLOYMENT_MODEL || !API_KEY) {
      alert("Missing configuration. Please set up environment variables.");
      setInputState('readyToStart');
      return;
    }

    try {
      realtimeStreamingRef.current = new LowLevelRTClient(
        new URL(ENDPOINT),
        { key: API_KEY },
        { deployment: DEPLOYMENT_MODEL }
      );

      await realtimeStreamingRef.current.send(createConfigMessage());
      await Promise.all([resetAudio(true), handleRealtimeMessages()]);
    } catch (error) {
      console.error("Realtime start error:", error);
      alert("Connection failed. Check console for details.");
      setInputState('readyToStart');
    }
  };

  const stopRealtime = async () => {
    setInputState('working');
    await resetAudio(false);
    
    if (realtimeStreamingRef.current) {
      realtimeStreamingRef.current.close();
    }
    
    setInputState('readyToStart');
  };

  const appendText = (text) => {
    setReceivedText(prev => [...prev, text]);
  };

  const appendToLastText = (text) => {
    setReceivedText(prev => {
      const newTexts = [...prev];
      newTexts.length === 0 ? newTexts.push(text) : newTexts[newTexts.length - 1] += text;
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
          <div className="flex justify-center space-x-6">
            <button
              type="button"
              onClick={startRealtime}
              disabled={inputState !== 'readyToStart'}
              className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transform hover:scale-105 transition-all duration-200 font-semibold"
            >
              Start
            </button>
            <button
              type="button"
              onClick={stopRealtime}
              disabled={inputState !== 'readyToStop'}
              className="px-6 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transform hover:scale-105 transition-all duration-200 font-semibold"
            >
              Stop
            </button>
          </div>

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
              Clear all
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AudioStreamingApp;