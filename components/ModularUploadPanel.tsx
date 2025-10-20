import React, { useRef, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { UploadCloudIcon, FileIcon, MicIcon, TextIcon } from './icons/Icons';

interface ModularUploadPanelProps {
  onTranscriptLoad?: (text: string) => void;
  onAudioLoad?: (file: File) => void;
  onTextFileLoad?: (text: string) => void;
}

export const ModularUploadPanel: React.FC<ModularUploadPanelProps> = ({
  onTranscriptLoad,
  onAudioLoad,
  onTextFileLoad
}) => {
  const { setAudioFile, setAudioFileName } = useData();
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Handle audio upload for transcription
  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate audio file
    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/m4a'];
    if (!validTypes.includes(file.type)) {
      setUploadStatus(`Invalid audio format. Supported: MP3, WAV, MP4, WEBM, M4A`);
      return;
    }

    setAudioFile(file);
    setAudioFileName(file.name);
    setUploadStatus(`Audio loaded: ${file.name}`);
    
    if (onAudioLoad) {
      onAudioLoad(file);
    }
  };

  // Handle transcript file upload (for direct editing)
  const handleTranscriptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Accept text files, JSON, etc.
    const validTypes = ['text/plain', 'application/json', 'text/markdown'];
    const validExtensions = ['.txt', '.json', '.md', '.srt', '.vtt'];
    
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      setUploadStatus(`Invalid transcript format. Supported: TXT, JSON, MD, SRT, VTT`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setUploadStatus(`Transcript loaded: ${file.name}`);
      
      if (onTranscriptLoad) {
        onTranscriptLoad(text);
      }
    };
    reader.readAsText(file);
  };

  // Handle text document upload (for reference/context)
  const handleTextDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setUploadStatus(`Document loaded: ${file.name}`);
      
      if (onTextFileLoad) {
        onTextFileLoad(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-3">Modular Upload System</h3>
      
      {/* Status message */}
      {uploadStatus && (
        <div className="bg-blue-500/20 border border-blue-500 rounded p-2 text-sm text-blue-300">
          {uploadStatus}
        </div>
      )}

      {/* Three separate upload buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Audio Upload (for transcription) */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Audio for Transcription</label>
          <button
            onClick={() => audioInputRef.current?.click()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-3 flex items-center justify-center space-x-2 transition-colors"
          >
            <MicIcon />
            <span>Upload Audio</span>
          </button>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-500">For AI transcription</p>
        </div>

        {/* Transcript Upload (for editing) */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Existing Transcript</label>
          <button
            onClick={() => transcriptInputRef.current?.click()}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-3 flex items-center justify-center space-x-2 transition-colors"
          >
            <FileIcon />
            <span>Load Transcript</span>
          </button>
          <input
            ref={transcriptInputRef}
            type="file"
            accept=".txt,.json,.md,.srt,.vtt,text/plain,application/json"
            onChange={handleTranscriptUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-500">Skip transcription, edit directly</p>
        </div>

        {/* Text Document Upload (for context) */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Reference Document</label>
          <button
            onClick={() => textInputRef.current?.click()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-3 flex items-center justify-center space-x-2 transition-colors"
          >
            <TextIcon />
            <span>Add Context</span>
          </button>
          <input
            ref={textInputRef}
            type="file"
            accept=".txt,.md,.pdf,.doc,.docx,text/*"
            onChange={handleTextDocumentUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-500">Additional context for AI</p>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Module Status:</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-gray-400">Text Editing: Ready</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            <span className="text-gray-400">Transcription: Isolated (error-prone module)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span className="text-gray-400">Audio Context: Available for GPT-4o</span>
          </div>
        </div>
      </div>
    </div>
  );
};