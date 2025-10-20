// Gemini Production Editor: Google AI Studio Integration with Right-Side Configuration
// Ultra-detailed logging for comprehensive debugging of "Failed to fetch" errors

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MonacoDiffEditor } from './DiffEditor';
import { ModelConfigPanel } from './ModelConfigPanel';
import { useGeminiStream, type GeminiConfig } from '../hooks/useGeminiStream';
import { useData } from '../contexts/DataContext';
import { transcribe as geminiTranscribe } from '../services/geminiService';
import { configManager } from '../services/configManager';
import { DownloadIcon, UploadCloudIcon, PlayIcon, PauseIcon, SettingsIcon } from './icons/Icons';

// Ultra-detailed logging imports
import { 
  debug, info, warn, error, trace, fatal,
  startTimer, endTimer, logComponent, logState, logFile 
} from '../services/debugLogger';

interface UploadedAudio {
  fileUri: string;
  fileName: string;
  mimeType: string;
}

export const GeminiProductionEditor: React.FC = () => {
  const { audioFile, audioFileName, audioSrc } = useData();
  const [uploadedAudioFile, setUploadedAudioFile] = useState<UploadedAudio | null>(null);
  const [config, setConfig] = useState<GeminiConfig>({
    model: 'gemini-2.5-pro',
    systemInstruction: 'You are an expert transcriber. Generate accurate transcripts with proper punctuation, capitalization, and paragraph breaks. Include speaker labels when multiple speakers are present.',
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192
  });
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentMode, setCurrentMode] = useState<'transcribe' | 'edit'>('transcribe');
  const [error, setError] = useState<string | null>(null);
  
  const { startStream, generateContent, isStreaming } = useGeminiStream();
  

  
  const handleTranscribe = useCallback(async () => {
    if (!audioFile) return;
    
    setIsTranscribing(true);
    setError(null);
    setStreamingText('');
    setOriginalText('');
    setCurrentMode('transcribe');
    
    try {
      // First upload the audio file to get the URI
      const formData = new FormData();
      formData.append('audio', audioFile);

      // Get API key headers from configManager
      const requestConfig = configManager.getRequestConfig('gemini');
      const uploadHeaders = { ...requestConfig.headers };
      delete uploadHeaders['Content-Type']; // Remove Content-Type for FormData
      
      info('GeminiProductionEditor', 'handleTranscribe', 'Starting audio upload', {
        url: 'http://localhost:3001/api/upload-audio',
        fileName: audioFile.name,
        fileSize: audioFile.size,
        headers: uploadHeaders,
        hasAPIKey: !!configManager.getAPIKey('gemini')
      });
      
      const uploadResponse = await fetch('http://localhost:3001/api/upload-audio', {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });
      
      info('GeminiProductionEditor', 'handleTranscribe', 'Upload response received', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        ok: uploadResponse.ok
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(`Audio upload failed: ${errorData.error || uploadResponse.statusText}`);
      }

      const { fileUri } = await uploadResponse.json();
      setUploadedAudioFile({ fileUri, fileName: audioFileName || 'audio', mimeType: audioFile.type });

      // Now transcribe using the uploaded file URI
      let accumulatedText = '';
      await startStream(
        'Generate a detailed transcript of this audio file. Include speaker labels if multiple speakers are present. Use proper punctuation and paragraph breaks.',
        config,
        {
          onChunk: (text) => {
            accumulatedText += text;
            setStreamingText(accumulatedText);
          },
          onComplete: () => {
            console.log('Transcription complete');
            setOriginalText(accumulatedText);
            setStreamingText('');
            setIsTranscribing(false);
          },
          onError: (error) => {
            console.error('Transcription error:', error);
            setError(`Transcription failed: ${error.message}`);
            setIsTranscribing(false);
            setStreamingText('');
          }
        },
        fileUri
      );
    } catch (error) {
      console.error('Transcription error:', error);
      setError(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTranscribing(false);
      setStreamingText('');
    }
  }, [audioFile, audioFileName, config, startStream]);
  
  const handleEdit = useCallback(async () => {
    if (!originalText || !prompt.trim()) return;
    
    setError(null);
    setEditedText('');
    setStreamingText('');
    setCurrentMode('edit');
    
    const editConfig = {
      ...config,
      systemInstruction: `You are a professional transcript editor.

RULES:
1. Apply the requested changes to the transcript
2. Maintain the original structure and formatting
3. Preserve speaker labels and timestamps if present
4. Output the COMPLETE edited transcript, not just changes
5. Do NOT include explanations or markdown formatting

Original transcript:
${originalText}

Edit instruction: ${prompt}`
    };
    
    try {
      await startStream(
        `Please edit the transcript according to this instruction: ${prompt}`,
        editConfig,
        {
          onChunk: (text) => {
            setStreamingText(prev => prev + text);
          },
          onComplete: () => {
            console.log('Edit complete');
            setEditedText(streamingText);
            setStreamingText('');
          },
          onError: (error) => {
            console.error('Edit error:', error);
            setError(`Edit failed: ${error.message}`);
            setStreamingText('');
          }
        },
        uploadedAudioFile?.fileUri
      );
    } catch (error) {
      console.error('Edit error:', error);
      setError(`Edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStreamingText('');
    }
  }, [originalText, prompt, config, startStream, audioFile, streamingText]);
  
  const handleAcceptChanges = useCallback(() => {
    setOriginalText(editedText);
    setEditedText('');
    setStreamingText('');
    setPrompt('');
  }, [editedText]);
  
  const handleRejectChanges = useCallback(() => {
    setEditedText('');
    setStreamingText('');
  }, []);
  
  const predefinedPrompts = [
    'Fix grammar and spelling errors',
    'Improve clarity and readability',
    'Add proper punctuation and capitalization',
    'Remove filler words (um, uh, like)',
    'Format as professional meeting notes',
    'Summarize key points and action items',
    'Convert to bullet points',
    'Add timestamps for important sections'
  ];
  
  return (
    <div className="gemini-production-editor p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🤖 Gemini Production AI Editor
        </h1>
        <p className="text-gray-600">
          Secure, production-ready AI transcription and editing with Gemini API
        </p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 border-l-4 border-red-400 bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto">
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {/* Shared Audio from Classic Editor */}
          <div className="bg-white border rounded-lg p-4">
            {audioFile && audioFileName ? (
              <div className="text-center">
                <div className="text-4xl mb-4">🎵</div>
                <div className="text-lg font-medium text-gray-900 mb-2">
                  Audio Ready
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-700">
                    ✅ <strong>{audioFileName}</strong>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Shared from Classic Editor
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Upload audio files in the Classic Editor tab to use here
                </p>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                <div className="text-4xl mb-4">📁</div>
                <div className="text-lg font-medium text-gray-600 mb-2">
                  No Audio File
                </div>
                <p className="text-sm text-gray-500">
                  Switch to the <strong>Classic Editor</strong> tab to upload an audio file, 
                  then return here to transcribe with AI.
                </p>
              </div>
            )}
          </div>
          

          
          {/* Action Buttons */}
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <button 
              onClick={handleTranscribe}
              disabled={!audioFile || isStreaming || isTranscribing}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isTranscribing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Transcribing...
                </>
              ) : (
                '🎤 Transcribe Audio'
              )}
            </button>
            
            {originalText && (
              <div className="border-t pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Edit Instructions:
                </label>
                <div className="mb-2">
                  <select 
                    value=""
                    onChange={(e) => e.target.value && setPrompt(e.target.value)}
                    className="block w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a preset...</option>
                    {predefinedPrompts.map((p, i) => (
                      <option key={i} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter custom editing instructions..."
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button 
                  onClick={handleEdit}
                  disabled={!prompt.trim() || isStreaming}
                  className="w-full mt-2 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isStreaming && currentMode === 'edit' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Editing...
                    </>
                  ) : (
                    '✨ Apply AI Edit'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Panel - Configuration & Results */}
        <div className="lg:w-96 space-y-6">
          {/* Model Configuration */}
          <ModelConfigPanel
            config={config}
            onConfigChange={setConfig}
            disabled={isStreaming || isTranscribing}
          />
          {/* Streaming Preview */}
          {isStreaming && streamingText && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {currentMode === 'transcribe' ? '🎤 Live Transcription' : '✨ AI Editing'}
              </h3>
              <div className="bg-gray-50 border rounded-lg p-4 max-h-60 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                  {streamingText}
                  <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse ml-1"></span>
                </pre>
              </div>
            </div>
          )}
          
          {/* Original Transcript */}
          {originalText && !isStreaming && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                📝 Current Transcript
              </h3>
              <div className="bg-white border rounded-lg p-4 max-h-60 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                  {originalText}
                </pre>
              </div>
            </div>
          )}
          
          {/* Diff Editor */}
          {editedText && originalText && (
            <div className="mb-6">
              <MonacoDiffEditor
                original={originalText}
                modified={editedText}
                onAccept={handleAcceptChanges}
                onReject={handleRejectChanges}
                language="markdown"
                height="500px"
              />
            </div>
          )}
          
          {/* Empty State */}
          {!originalText && !isStreaming && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">🎤</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Ready to transcribe
              </h3>
              <p className="text-gray-500">
                Upload an audio file and click "Transcribe Audio" to get started with AI-powered transcription.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};