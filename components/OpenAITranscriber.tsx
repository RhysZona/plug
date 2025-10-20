// OpenAI Whisper Transcription Component
// Completely separate from other editors to avoid conflicts

import React, { useState, useRef } from 'react';
import { openaiService, TranscriptionResult } from '../services/openaiService';
import { configManager } from '../services/configManager';
import { UploadCloudIcon } from './icons/Icons';

interface OpenAITranscriberProps {
  onTranscriptionComplete: (transcript: string) => void;
}

export const OpenAITranscriber: React.FC<OpenAITranscriberProps> = ({ onTranscriptionComplete }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setAudioFile(file);
    setError(null);
    setTranscription(null);
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      setError('Please select an audio file first');
      return;
    }

    // Check if API key is configured
    const apiKey = configManager.getAPIKey('openai');
    if (!apiKey) {
      setError('OpenAI API key not configured. Please set it in settings.');
      return;
    }

    setTranscribing(true);
    setError(null);

    try {
      const result = await openaiService.transcribeAudio(audioFile, 'en');
      setTranscription(result);
      onTranscriptionComplete(result.transcript);
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          OpenAI Whisper Transcription
        </h3>
        <p className="text-sm text-gray-400">
          Upload audio files up to 25MB for transcription
        </p>
      </div>

      {/* File Input */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors flex flex-col items-center"
        >
          <UploadCloudIcon className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-gray-300">
            {audioFile ? audioFile.name : 'Click to select audio file'}
          </span>
          {audioFile && (
            <span className="text-xs text-gray-500 mt-1">
              {formatFileSize(audioFile.size)}
            </span>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Transcribe Button */}
      <button
        onClick={handleTranscribe}
        disabled={!audioFile || transcribing}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          !audioFile || transcribing
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {transcribing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Transcribing...
          </span>
        ) : (
          'Transcribe with OpenAI Whisper'
        )}
      </button>

      {/* Transcription Result */}
      {transcription && (
        <div className="mt-4 p-4 bg-gray-900 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Transcription Result</h4>
          <p className="text-white text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
            {transcription.transcript}
          </p>
          {transcription.segments && (
            <p className="text-xs text-gray-500 mt-2">
              {transcription.segments.length} segments • {transcription.duration}s duration
            </p>
          )}
        </div>
      )}
    </div>
  );
};