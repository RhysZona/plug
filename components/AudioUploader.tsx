import React, { useState, useRef, useCallback } from 'react';

interface UploadedAudio {
  fileUri: string;
  fileName: string;
  mimeType: string;
}

interface AudioUploaderProps {
  onUploadComplete: (audio: UploadedAudio) => void;
  disabled?: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onUploadComplete,
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validFormats = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/flac'];
  const maxSize = 100 * 1024 * 1024; // 100MB

  const validateFile = (file: File): string | null => {
    if (!validFormats.includes(file.type)) {
      return 'Unsupported audio format. Please use WAV, MP3, AAC, OGG, or FLAC files.';
    }
    
    if (file.size > maxSize) {
      return 'File too large. Maximum size is 100MB.';
    }
    
    return null;
  };

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      const uploadPromise = new Promise<UploadedAudio>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (e) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));
      });

      xhr.open('POST', 'http://localhost:3001/api/upload-audio');
      xhr.timeout = 120000; // 2 minute timeout
      xhr.send(formData);

      const result = await uploadPromise;
      onUploadComplete(result);
      setUploadProgress(100);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error('Audio upload error:', err);
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleClick = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${dragActive 
            ? 'border-brand-blue bg-brand-blue/10' 
            : 'border-gray-600 hover:border-gray-500'
          }
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800/50'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        <div className="space-y-2">
          <div className="text-4xl mb-4">
            {uploading ? '⏳' : '🎵'}
          </div>

          {uploading ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-brand-blue">
                Uploading... {uploadProgress}%
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-brand-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-medium text-gray-200 mb-2">
                {dragActive ? 'Drop your audio file here' : 'Upload Audio File'}
              </div>
              <div className="text-sm text-gray-400 mb-4">
                Drag and drop or click to select
              </div>
              <div className="text-xs text-gray-500">
                Supported: WAV, MP3, AAC, OGG, FLAC<br />
                Maximum size: 100MB
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {!uploading && (
        <div className="mt-4 text-center">
          <button
            onClick={handleClick}
            disabled={disabled}
            className="
              px-4 py-2 bg-brand-blue text-white rounded hover:bg-blue-600 
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors
            "
          >
            Choose File
          </button>
        </div>
      )}
    </div>
  );
};