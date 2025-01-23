import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MessageFeedback from './MessageFeedback';
import RAGService from '../services/RAGService';
import VoiceService from '../services/VoiceService';
import api from '../services/api';

const Chat = () => {
  const { agentId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const startConversation = async () => {
      try {
        const data = await api.startConversation(agentId);
        setConversation(data.conversation);
      } catch (error) {
        console.error('Error starting conversation:', error);
      }
    };

    startConversation();
  }, [agentId]);

  useEffect(() => {
    const loadVoices = async () => {
      const voices = await VoiceService.getVoices();
      setAvailableVoices(voices);
      setSelectedVoice(voices[0]); // Default to first available voice
    };

    loadVoices();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processWithRAG = async (userInput) => {
    try {
      const ragResponse = await RAGService.processQuery(agentId, userInput, user.token);
      return ragResponse.enhancedResponse;
    } catch (error) {
      console.error('RAG processing error:', error);
      return userInput; // Fallback to original input if RAG fails
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const newMessage = {
      role: 'user',
      content: input,
    };

    setMessages([...messages, newMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await api.sendMessage(conversation.id, input);
      setMessages([...messages, newMessage, data.message]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
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
        // Send audio to backend for processing
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          const response = await fetch('/api/stream', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${user.token}`,
            },
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            setInput(data.text);
          }
        } catch (error) {
          console.error('Error processing audio:', error);
        }
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

  const startVoiceInput = async () => {
    try {
      setIsListening(true);
      await VoiceService.startListening(
        (interim) => setInterimTranscript(interim),
        (final) => {
          setInput(final);
          setInterimTranscript('');
          setIsListening(false);
        }
      );
    } catch (error) {
      console.error('Voice input error:', error);
      setIsListening(false);
    }
  };

  const stopVoiceInput = () => {
    VoiceService.stopListening();
    setIsListening(false);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <select
          value={selectedVoice?.name}
          onChange={(e) => {
            const voice = availableVoices.find(v => v.name === e.target.value);
            setSelectedVoice(voice);
          }}
          className="voice-select"
        >
          {availableVoices.map(voice => (
            <option key={voice.name} value={voice.name}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>

      <div className="messages-container">
        {messages.map((message, index) => (
          <div key={index} className="message-container">
            <div className={`message ${message.role === 'user' ? 'user' : 'agent'}`}>
              {message.content}
            </div>
            {message.role === 'agent' && (
              <MessageFeedback
                messageId={message.id}
                onFeedbackSubmit={() => {
                  // Optionally refresh messages or update UI
                }}
              />
            )}
          </div>
        ))}
        {interimTranscript && (
          <div className="interim-transcript">
            {interimTranscript}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
          disabled={loading || isListening}
          className="chat-input"
        />
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`btn-icon ${isRecording ? 'recording' : ''}`}
        >
          {isRecording ? '⏹️' : '🎤'}
        </button>
        <button
          onClick={isListening ? stopVoiceInput : startVoiceInput}
          className={`btn-icon ${isListening ? 'recording' : ''}`}
        >
          {isListening ? '⏹️' : '🎤'}
        </button>
        <button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          className="btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat; 