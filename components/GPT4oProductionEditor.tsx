// GPT-4o Production Editor: OpenAI Whisper + GPT-4o Audio Preview Integration
// Bug-resistant implementation with comprehensive error handling

import React, { useState, useEffect, useRef } from 'react';
import { openaiService, OpenAIConfig, TranscriptionResult } from '../services/openaiService';
import { useOpenAIStream } from '../hooks/useOpenAIStream';
import { useData } from '../contexts/DataContext';
import { MonacoDiffEditor } from './DiffEditor';
import { DownloadIcon, UploadCloudIcon, PlayIcon, PauseIcon, SettingsIcon } from './icons/Icons';
import { OpenAITranscriber } from './OpenAITranscriber';

interface GPT4oEditorState {
  audioFile: File | null;
  transcription: TranscriptionResult | null;
  transcriptText: string;
  editCommand: string;
  editedText: string;
  showDiff: boolean;
  audioBase64: string | null;
}

export const GPT4oProductionEditor: React.FC = () => {
  const { audioFile: sharedAudioFile, audioFileName } = useData();
  
  // Component state
  const [state, setState] = useState<GPT4oEditorState>({
    audioFile: null,
    transcription: null,
    transcriptText: '',
    editCommand: '',
    editedText: '',
    showDiff: false,
    audioBase64: null
  });

  // Loading states
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  
  // Config state
  const [config, setConfig] = useState<OpenAIConfig>({
    model: 'gpt-4o-audio-preview',
    systemInstruction: openaiService.getSystemInstruction('transcript_editor'),
    temperature: 0.7,
    maxTokens: 4096,
    modalities: ['text']
  });
  
  const [showConfig, setShowConfig] = useState(false);

  // Streaming hook
  const { 
    isStreaming, 
    error: streamError, 
    accumulatedText,
    tokenCount,
    startStream, 
    stopStream, 
    resetStream 
  } = useOpenAIStream();

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use shared audio file from Classic Editor if available
  useEffect(() => {
    if (sharedAudioFile && !state.audioFile) {
      setState(prev => ({ ...prev, audioFile: sharedAudioFile }));
    }
  }, [sharedAudioFile, state.audioFile]);

  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = openaiService['validateAudioFile'](file);
    if (!validation.valid) {
      setTranscriptionError(validation.error || 'Invalid audio file');
      return;
    }

    setState(prev => ({ 
      ...prev, 
      audioFile: file,
      transcription: null,
      transcriptText: '',
      editedText: '',
      showDiff: false
    }));
    setTranscriptionError(null);
  };

  const handleTranscribe = async () => {
    if (!state.audioFile) {
      setTranscriptionError('No audio file selected');
      return;
    }

    setTranscribing(true);
    setTranscriptionError(null);

    try {
      console.log('🎤 Starting Whisper transcription...');
      
      const result = await openaiService.transcribeAudio(state.audioFile);
      
      console.log(`✅ Transcription completed: ${result.transcript.length} chars`);
      
      setState(prev => ({
        ...prev,
        transcription: result,
        transcriptText: result.transcript,
        editedText: '',
        showDiff: false
      }));
      
    } catch (error: any) {
      console.error('❌ Transcription failed:', error);
      setTranscriptionError(error.message || 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  const handleEdit = async () => {
    if (!state.transcriptText || !state.editCommand) {
      return;
    }

    // Validate context limits
    const contextCheck = openaiService.checkContextLimit(
      state.transcriptText, 
      state.transcription?.duration || 0
    );
    
    if (!contextCheck.valid) {
      setTranscriptionError(contextCheck.error || 'Context too large');
      return;
    }

    setState(prev => ({ ...prev, editedText: '', showDiff: false }));
    setTranscriptionError(null);
    resetStream();

    try {
      await startStream(
        state.transcriptText,
        state.editCommand,
        config,
        {
          onChunk: (chunk: string) => {
            setState(prev => ({ ...prev, editedText: prev.editedText + chunk }));
          },
          onComplete: () => {
            console.log('✅ GPT-4o editing completed');
            setState(prev => ({ ...prev, showDiff: true }));
          },
          onError: (error: Error) => {
            console.error('❌ GPT-4o editing failed:', error);
            setTranscriptionError(error.message);
          }
        },
        state.audioBase64 || undefined
      );
    } catch (error: any) {
      console.error('❌ Stream setup failed:', error);
      setTranscriptionError(error.message);
    }
  };

  const handleAcceptChanges = () => {
    setState(prev => ({
      ...prev,
      transcriptText: prev.editedText,
      editedText: '',
      showDiff: false,
      editCommand: ''
    }));
    resetStream();
  };

  const handleRejectChanges = () => {
    setState(prev => ({
      ...prev,
      editedText: '',
      showDiff: false
    }));
    resetStream();
  };

  const handleDownload = () => {
    const text = state.editedText || state.transcriptText;
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-gpt4o-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const displayError = transcriptionError || (streamError?.message);
  const canTranscribe = state.audioFile && !transcribing;
  const canEdit = state.transcriptText && state.editCommand && !isStreaming;
  const hasSharedAudio = Boolean(sharedAudioFile);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-white">
            🧠 GPT-4o Production Editor
          </h2>
          <div className="text-sm text-gray-400">
            OpenAI Whisper + GPT-4o Audio Preview
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {state.transcription && (
            <div className="text-xs text-gray-400 mr-4">
              {state.transcription.duration}s • {state.transcription.segments?.length || 0} words
              {tokenCount > 0 && ` • ~${tokenCount.toLocaleString()} tokens`}
            </div>
          )}
          
          <button
            onClick={handleDownload}
            disabled={!state.transcriptText}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Download transcript"
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-md transition-colors ${
              showConfig 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Model configuration"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Audio Upload Section */}
          <div className="p-4 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center space-x-4">
              {hasSharedAudio ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-green-400 flex items-center">
                    ✅ Using shared audio: <span className="ml-1 font-mono text-xs">{audioFileName}</span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-400 hover:text-white underline"
                  >
                    Upload different file
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                  >
                    <UploadCloudIcon className="w-4 h-4" />
                    <span>Upload Audio</span>
                  </button>
                  <div className="text-xs text-gray-400">
                    Max: 25MB • MP3, WAV, MP4, WEBM
                  </div>
                </div>
              )}
              
              {state.audioFile && (
                <button
                  onClick={handleTranscribe}
                  disabled={!canTranscribe}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {transcribing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PlayIcon className="w-4 h-4" />
                  )}
                  <span>
                    {transcribing ? 'Transcribing...' : 'Transcribe with Whisper'}
                  </span>
                </button>
              )}
            </div>
            
            {displayError && (
              <div className="mt-3 p-3 bg-red-900/20 border border-red-700/50 rounded-md text-red-400 text-sm">
                {displayError}
              </div>
            )}
          </div>

          {/* Edit Controls */}
          {state.transcriptText && (
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={state.editCommand}
                  onChange={(e) => setState(prev => ({ ...prev, editCommand: e.target.value }))}
                  placeholder="Enter editing command (e.g., 'Fix grammar and punctuation')"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isStreaming}
                />
                
                <button
                  onClick={handleEdit}
                  disabled={!canEdit}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  {isStreaming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-4 h-4" />
                      <span>Generate Edit</span>
                    </>
                  )}
                </button>
                
                {isStreaming && (
                  <button
                    onClick={stopStream}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors"
                  >
                    <PauseIcon className="w-4 h-4" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {state.showDiff && state.editedText ? (
              /* Diff View */
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-700 bg-gray-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Proposed Changes</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleRejectChanges}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={handleAcceptChanges}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm transition-colors"
                      >
                        Accept Changes
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <MonacoDiffEditor
                    original={state.transcriptText}
                    modified={state.editedText}
                    onAccept={handleAcceptChanges}
                    onReject={handleRejectChanges}
                  />
                </div>
              </div>
            ) : (
              /* Transcript View */
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-700 bg-gray-800">
                  <h3 className="text-lg font-medium">
                    {state.transcriptText ? 'Transcript' : 'No transcript available'}
                  </h3>
                </div>
                
                <div className="flex-1 p-4 overflow-auto">
                  {isStreaming && state.editedText ? (
                    <div className="space-y-4">
                      <div className="text-sm text-blue-400 flex items-center">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                        Streaming GPT-4o response...
                      </div>
                      <textarea
                        value={state.editedText}
                        readOnly
                        className="w-full h-64 p-3 bg-gray-800 border border-gray-600 rounded-md text-white font-mono text-sm resize-none"
                        placeholder="GPT-4o response will appear here..."
                      />
                    </div>
                  ) : state.transcriptText ? (
                    <textarea
                      value={state.transcriptText}
                      onChange={(e) => setState(prev => ({ ...prev, transcriptText: e.target.value }))}
                      className="w-full h-full p-3 bg-gray-800 border border-gray-600 rounded-md text-white font-mono text-sm resize-none"
                      placeholder="Transcript will appear here after transcription..."
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-400">
                      {hasSharedAudio 
                        ? 'Click "Transcribe with Whisper" to get started'
                        : 'Upload an audio file to begin transcription'
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Panel (if shown) */}
        {showConfig && (
          <div className="w-80 border-l border-gray-700 bg-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-medium">Model Configuration</h3>
            </div>
            
            <div className="flex-1 p-4 overflow-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Model
                </label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="gpt-4o-audio-preview">GPT-4o Audio Preview</option>
                  <option value="gpt-4o">GPT-4o (text only)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Temperature: {config.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Lower = more focused, Higher = more creative
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Max Tokens: {config.maxTokens}
                </label>
                <input
                  type="range"
                  min="256"
                  max="16384"
                  step="256"
                  value={config.maxTokens}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Maximum tokens for output
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  System Instruction
                </label>
                <textarea
                  value={config.systemInstruction}
                  onChange={(e) => setConfig(prev => ({ ...prev, systemInstruction: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm font-mono"
                  placeholder="Define the AI's behavior and output format..."
                />
              </div>
              
              <div className="pt-2 border-t border-gray-600">
                <button
                  onClick={() => setConfig(prev => ({ 
                    ...prev, 
                    systemInstruction: openaiService.getSystemInstruction('transcript_editor')
                  }))}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  Reset to default transcript editor prompt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};