# OpenAI GPT-4o Audio Preview + VSCode Cline-Style Text Editor: Comprehensive Production Guide

## Architecture Overview

Your OpenAI-based application requires four core components:

1. **Audio Upload & Transcription Layer** (Whisper API for transcription)
2. **Audio Context Management** (GPT-4o Audio Preview for audio-aware editing)  
3. **Streaming Response Handler** (Chat Completions with streaming)
4. **Diff Editor Integration** (Accept/deny/auto-apply patches)

**Critical security requirement**: Never expose API keys in React frontend—use a Node.js backend proxy pattern.

---

## 1. Security Architecture: Backend Proxy Pattern

### Why Backend Proxy is Mandatory

Exposing your OpenAI API key in React code is a severe security vulnerability. API keys embedded in client-side JavaScript can be extracted, leading to unauthorized usage and unexpected billing.

### Recommended Architecture

```
[React Frontend] → [Node.js/Express Backend] → [OpenAI API]
```

### Backend Implementation (Express + OpenAI SDK):

```javascript
// server.js
import express from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const upload = multer({ dest: 'uploads/' });

// CRITICAL: API key ONLY on backend
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Whisper transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioPath = req.file.path;
    
    // Whisper API has 25MB file limit
    const stats = fs.statSync(audioPath);
    if (stats.size > 25 * 1024 * 1024) {
      return res.status(413).json({ 
        error: 'File too large. Maximum 25MB for Whisper API' 
      });
    }
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: req.body.language || 'en', // Optional: specify language
      response_format: 'verbose_json', // Get timestamps
      timestamp_granularities: ['word'] // Word-level timestamps
    });
    
    // Clean up uploaded file
    fs.unlinkSync(audioPath);
    
    res.json({
      transcript: transcription.text,
      segments: transcription.words, // Word-level timing
      duration: transcription.duration
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GPT-4o Audio Preview with streaming for editing
app.post('/api/stream-edit', async (req, res) => {
  const { transcript, editCommand, audioBase64, config } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    const messages = [
      {
        role: 'system',
        content: config.systemInstruction || 'You are a professional text editor.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Original transcript: ${transcript}` },
          { type: 'text', text: `Edit command: ${editCommand}` }
        ]
      }
    ];
    
    // Add audio context if provided
    if (audioBase64) {
      messages[1].content.push({
        type: 'input_audio',
        input_audio: {
          data: audioBase64,
          format: 'wav'
        }
      });
    }
    
    const stream = await openai.chat.completions.create({
      model: config.model || 'gpt-4o-audio-preview',
      modalities: ['text'], // Text output only for editing
      messages,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 4096,
      stream: true
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.listen(3001, () => console.log('Backend running on port 3001'));
```

---

## 2. Audio Upload & Transcription Workflow

### Whisper API: Key Specifications

- **Maximum file size**: 25 MB
- **Supported formats**: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
- **Optimal format**: MP3 at 16 kbps, 12 kHz, mono for best latency
- **Maximum duration**: ~2.5 hours (depending on format/bitrate)
- **No native context retention**: Unlike Gemini Files API, Whisper doesn't keep audio in context—you need to store transcripts

### React Frontend Upload Component:

```typescript
// AudioUploader.tsx
import React, { useState } from 'react';

interface TranscriptionResult {
  transcript: string;
  segments: Array<{ word: string; start: number; end: number }>;
  duration: number;
}

export const AudioUploader: React.FC<{
  onTranscribeComplete: (result: TranscriptionResult) => void
}> = ({ onTranscribeComplete }) => {
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (25MB limit)
    if (file.size > 25 * 1024 * 1024) {
      alert('File too large. Maximum 25MB. Consider compressing audio.');
      return;
    }
    
    // Validate format
    const validFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm'];
    if (!validFormats.includes(file.type)) {
      alert('Unsupported format. Use MP3, WAV, MP4, or WEBM.');
      return;
    }
    
    setTranscribing(true);
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('language', 'en'); // Optional
    
    try {
      const response = await fetch('http://localhost:3001/api/transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      
      const result = await response.json();
      onTranscribeComplete(result);
    } catch (error) {
      console.error('Transcription error:', error);
      alert(`Transcription failed: ${error.message}`);
    } finally {
      setTranscribing(false);
    }
  };
  
  return (
    <div className="audio-uploader">
      <input 
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        disabled={transcribing}
      />
      {transcribing && (
        <div className="transcription-status">
          <span>Transcribing...</span>
          <progress value={progress} max={100} />
        </div>
      )}
      <div className="file-info">
        <p>Max size: 25MB</p>
        <p>Formats: MP3, WAV, MP4, WEBM</p>
        <p>Tip: Use 16kbps MP3 for fastest results</p>
      </div>
    </div>
  );
};
```

### Handling Large Files (>25MB)

Whisper has a hard 25MB limit. For longer audio:

#### Option 1: Audio Compression

```javascript
// Recommended settings for compression
// - Bitrate: 16 kbps
// - Sample Rate: 12 kHz  
// - Channels: Mono

// Using FFmpeg (server-side)
import ffmpeg from 'fluent-ffmpeg';

const compressAudio = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate('16k')
      .audioFrequency(12000)
      .audioChannels(1)
      .toFormat('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
};
```

#### Option 2: Chunking Audio

```javascript
// Split audio into chunks at silence points
const chunkAudio = async (audioPath) => {
  const chunks = [];
  const chunkDuration = 600; // 10 minutes per chunk
  
  // Use FFmpeg to detect silence and split
  // Ensure chunks split at silence to preserve sentence continuity
  const silenceDetection = await detectSilence(audioPath);
  const splitPoints = calculateOptimalSplits(silenceDetection, chunkDuration);
  
  for (const [start, end] of splitPoints) {
    const chunkPath = await extractChunk(audioPath, start, end);
    chunks.push(chunkPath);
  }
  
  return chunks;
};

// Transcribe chunks with context
const transcribeChunks = async (chunks) => {
  let fullTranscript = '';
  let previousText = '';
  
  for (const chunk of chunks) {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(chunk),
      model: 'whisper-1',
      prompt: previousText // Use previous chunk as context
    });
    
    fullTranscript += transcription.text + ' ';
    previousText = transcription.text.slice(-224); // Last 224 chars as context
  }
  
  return fullTranscript;
};
```

---

## 3. Model Configuration & System Instructions

### Available Models (As of 2025)

| Model | Context Window | Audio Support | Use Case |
|-------|----------------|---------------|-----------|
| gpt-4o-audio-preview | 128K tokens | Input + Output | Audio-aware editing, voice responses |
| gpt-4o-transcribe | N/A | Input only | High-quality transcription |
| whisper-1 | N/A | Input only | General transcription |

### GPT-4o Audio Preview Configuration

```typescript
interface OpenAIConfig {
  model: string;
  systemInstruction: string;
  temperature: number;        // 0.0-2.0 (default: 1.0)
  maxTokens: number;          // Max: 16,384 for gpt-4o-audio-preview
  topP?: number;              // 0.0-1.0 (default: 1.0)
  frequencyPenalty?: number;  // -2.0 to 2.0
  presencePenalty?: number;   // -2.0 to 2.0
  modalities: string[];       // ['text', 'audio']
  audio?: {
    voice: string;            // 'alloy', 'echo', 'shimmer'
    format: string;           // 'wav', 'mp3', 'flac', 'opus', 'pcm16'
  };
}
```

### React Component for Model Settings:

```typescript
// ModelConfigPanel.tsx
import React, { useState } from 'react';

export const ModelConfigPanel: React.FC<{
  onConfigChange: (config: OpenAIConfig) => void
}> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<OpenAIConfig>({
    model: 'gpt-4o-audio-preview',
    systemInstruction: `You are a professional transcript editor.

OUTPUT FORMAT: Generate diffs in unified diff format:
--- original.txt
+++ edited.txt
@@ -line_number,count +line_number,count @@
-removed line
+added line
 unchanged line

RULES:
1. Output ONLY the diff, no explanations
2. Preserve line numbers
3. Group related changes into hunks
4. Do NOT add markdown formatting`,
    temperature: 0.7,
    maxTokens: 4096,
    modalities: ['text']
  });
  
  const updateConfig = (field: keyof OpenAIConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };
  
  return (
    <div className="config-panel">
      <h3>Model Configuration</h3>
      
      <label>
        Model:
        <select 
          value={config.model}
          onChange={(e) => updateConfig('model', e.target.value)}
        >
          <option value="gpt-4o-audio-preview">GPT-4o Audio Preview</option>
          <option value="gpt-4o">GPT-4o (text only)</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
        </select>
      </label>
      
      <label>
        Temperature ({config.temperature}):
        <input 
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature}
          onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
        />
        <span className="help">Lower = more focused, Higher = more creative</span>
      </label>
      
      <label>
        Max Tokens ({config.maxTokens}):
        <input 
          type="number"
          min="256"
          max="16384"
          value={config.maxTokens}
          onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
        />
        <span className="help">GPT-4o audio preview max: 16,384</span>
      </label>
      
      <label>
        System Instruction:
        <textarea 
          rows={8}
          value={config.systemInstruction}
          onChange={(e) => updateConfig('systemInstruction', e.target.value)}
          placeholder="Define the AI's behavior and output format..."
        />
      </label>
      
      <label>
        <input 
          type="checkbox"
          checked={config.modalities.includes('audio')}
          onChange={(e) => {
            const modalities = e.target.checked 
              ? ['text', 'audio'] 
              : ['text'];
            updateConfig('modalities', modalities);
          }}
        />
        Enable Audio Output
      </label>
      
      {config.modalities.includes('audio') && (
        <>
          <label>
            Voice:
            <select 
              value={config.audio?.voice || 'alloy'}
              onChange={(e) => updateConfig('audio', { 
                ...config.audio, 
                voice: e.target.value 
              })}
            >
              <option value="alloy">Alloy</option>
              <option value="echo">Echo</option>
              <option value="shimmer">Shimmer</option>
            </select>
          </label>
          
          <label>
            Audio Format:
            <select 
              value={config.audio?.format || 'wav'}
              onChange={(e) => updateConfig('audio', { 
                ...config.audio, 
                format: e.target.value 
              })}
            >
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
              <option value="opus">Opus</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
};
```

### System Instruction Best Practices

```javascript
const systemInstructions = {
  transcriptEditor: `You are a professional transcript editor.

OUTPUT: Generate changes in unified diff format.

FORMAT:
--- original.txt
+++ edited.txt
@@ -start,count +start,count @@
-removed line
+added line
 context line

RULES:
- Output ONLY the diff
- No explanations or commentary
- Preserve speaker labels if present
- Group related edits into hunks
- Use context lines between changes`,

  jsonResponder: `You are a JSON formatter. Output ONLY valid JSON. No markdown, no code blocks.
Schema: { "text": string, "confidence": number }`,

  diffGenerator: `You are a code/text diff generator. Use git diff unified format. Include 3 lines of context. Mark additions with + and removals with -.`
};
```

---

## 4. Streaming Response Handler

### Server-Sent Events (SSE) Pattern

### React Hook for Streaming:

```typescript
// useOpenAIStream.ts
import { useState, useCallback } from 'react';

interface StreamOptions {
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export const useOpenAIStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  
  const startStream = useCallback(async (
    transcript: string,
    editCommand: string,
    audioBase64: string | null,
    config: OpenAIConfig,
    options: StreamOptions
  ) => {
    setIsStreaming(true);
    let accumulatedText = '';
    
    try {
      const response = await fetch('http://localhost:3001/api/stream-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript, 
          editCommand, 
          audioBase64,
          config 
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              options.onComplete();
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                options.onError(new Error(parsed.error));
                break;
              }
              
              if (parsed.text) {
                accumulatedText += parsed.text;
                options.onChunk(parsed.text);
              }
            } catch (e) {
              // Skip malformed JSON
              console.warn('JSON parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      options.onError(error as Error);
    } finally {
      setIsStreaming(false);
    }
  }, []);
  
  return { startStream, isStreaming };
};
```

---

## 5. Diff Editor Integration

The diff editor implementation is identical to the Gemini version since it's frontend-only. Use Monaco Editor or React Diff Viewer for:

- Monaco Editor setup
- React Diff Viewer alternatives  
- diff-match-patch implementation

---

## 6. Rate Limiting & Error Handling

### OpenAI Rate Limits (2025)

**GPT-4o Audio Preview (Tier 1)**:
- **RPM** (Requests per minute): 500
- **TPM** (Tokens per minute): 30,000
- **Batch queue limit**: 90,000 tokens

**Whisper API**:
- **RPM**: 50 (varies by tier)
- **File size**: 25MB max per request

### Common OpenAI Errors

| Error Code | Meaning | Solution |
|------------|---------|-----------|
| 401 | Invalid/expired API key | Regenerate key from dashboard |
| 404 | Model not found | Check model name spelling |
| 413 | File too large | Compress or chunk audio |
| 429 | Rate limit exceeded | Implement exponential backoff |
| 500 | Server error | Retry with backoff |
| Context length exceeded | Token limit exceeded | Reduce prompt/output size |

### Exponential Backoff Implementation

```typescript
// retryWithBackoff.ts
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
}

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 60000,
    multiplier: 2
  }
): Promise<T> => {
  let delay = config.initialDelay;
  
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      // Check if error is retryable
      const isRetryable = [429, 500, 502, 503, 504].includes(error.status);
      
      if (!isRetryable || attempt === config.maxRetries - 1) {
        throw error;
      }
      
      // Log retry attempt
      console.warn(
        `Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`,
        `Error: ${error.message}`
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(
        delay * config.multiplier + Math.random() * 1000,
        config.maxDelay
      );
    }
  }
  
  throw new Error('Max retries exceeded');
};

// Usage in backend
app.post('/api/transcribe', async (req, res) => {
  try {
    const result = await retryWithBackoff(async () => {
      return await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1'
      });
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Request Queue for Rate Limiting

```typescript
// requestQueue.ts
class OpenAIRequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestTimestamps: number[] = [];
  private rpmLimit = 500; // Tier 1 limit
  private tpmLimit = 30000;
  private currentTokens = 0;
  
  async enqueue<T>(fn: () => Promise<T>, estimatedTokens: number): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Check rate limits
          await this.waitForRateLimit(estimatedTokens);
          
          const result = await fn();
          
          // Track usage
          this.recordRequest(estimatedTokens);
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  private async waitForRateLimit(tokens: number) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove requests older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    // Check RPM limit
    if (this.requestTimestamps.length >= this.rpmLimit) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = 60000 - (now - oldestRequest);
      console.log(`Rate limit: waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
    }
    
    // Check TPM limit
    if (this.currentTokens + tokens > this.tpmLimit) {
      console.log('Token limit: waiting 60s');
      await new Promise(r => setTimeout(r, 60000));
      this.currentTokens = 0;
    }
  }
  
  private recordRequest(tokens: number) {
    this.requestTimestamps.push(Date.now());
    this.currentTokens += tokens;
  }
  
  private async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
    }
    
    this.processing = false;
  }
}

export const openaiQueue = new OpenAIRequestQueue();
```

---

## 7. Common Pitfalls & Solutions

### ❌ PITFALL 1: Exposing API Keys in Frontend

**Solution**: Always use backend proxy

### ❌ PITFALL 2: Hitting 25MB Whisper Limit

Whisper has a hard 25MB limit that cannot be increased.

**Solutions**:
- Compress audio to 16kbps MP3
- Chunk files at silence points
- Use prompt parameter for context between chunks

```javascript
// Backend chunking strategy
app.post('/api/transcribe-large', upload.single('audio'), async (req, res) => {
  const audioPath = req.file.path;
  const stats = fs.statSync(audioPath);
  
  if (stats.size <= 25 * 1024 * 1024) {
    // Single request
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1'
    });
    return res.json(result);
  }
  
  // Chunk large files
  const chunks = await splitAudioAtSilence(audioPath, 25 * 1024 * 1024);
  let fullTranscript = '';
  let previousContext = '';
  
  for (const chunkPath of chunks) {
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(chunkPath),
      model: 'whisper-1',
      prompt: previousContext // Maintain context
    });
    
    fullTranscript += result.text + ' ';
    previousContext = result.text.slice(-224); // Last 224 chars
    fs.unlinkSync(chunkPath); // Clean up
  }
  
  res.json({ text: fullTranscript });
});
```

### ❌ PITFALL 3: Not Handling Context Length Errors

GPT-4o audio preview has 128K context, but audio uses ~170 tokens/minute.

**Solution**:

```typescript
const estimateAudioTokens = (durationSeconds: number): number => {
  return Math.ceil(durationSeconds / 60 * 170);
};

const checkContextLimit = (transcript: string, audioTokens: number) => {
  const textTokens = transcript.length / 4; // Rough estimate
  const totalTokens = textTokens + audioTokens;
  
  if (totalTokens > 120000) { // Leave buffer
    throw new Error(`Context too large: ${totalTokens} tokens. Max: 128K`);
  }
};
```

### ❌ PITFALL 4: Ignoring Rate Limit Headers

OpenAI returns rate limit info in response headers:

```typescript
const checkRateLimits = (response: Response) => {
  const remaining = response.headers.get('x-ratelimit-remaining-requests');
  const resetTime = response.headers.get('x-ratelimit-reset-requests');
  
  console.log(`Rate limit: ${remaining} requests remaining`);
  console.log(`Resets in: ${resetTime}`);
  
  if (parseInt(remaining || '0') < 10) {
    console.warn('Approaching rate limit!');
  }
};
```

### ❌ PITFALL 5: Not Validating Audio Format

```typescript
const validateAudioFile = (file: File): { valid: boolean; error?: string } => {
  const validMimeTypes = [
    'audio/mp3', 'audio/mpeg', 'audio/wav', 
    'audio/mp4', 'audio/webm', 'audio/m4a'
  ];
  
  if (!validMimeTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `Unsupported format: ${file.type}. Use MP3, WAV, MP4, or WEBM.` 
    };
  }
  
  if (file.size > 25 * 1024 * 1024) {
    return { 
      valid: false, 
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 25MB.` 
    };
  }
  
  return { valid: true };
};
```

### ❌ PITFALL 6: Not Handling Timeouts

```typescript
const transcribeWithTimeout = async (audioPath: string, timeoutMs = 120000) => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Transcription timeout')), timeoutMs)
  );
  
  const transcriptionPromise = openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1'
  });
  
  return Promise.race([transcriptionPromise, timeoutPromise]);
};
```

---

## 8. Complete React Application Example

```typescript
// App.tsx
import React, { useState } from 'react';
import { AudioUploader } from './AudioUploader';
import { ModelConfigPanel } from './ModelConfigPanel';
import { MonacoDiffEditor } from './DiffEditor';
import { useOpenAIStream } from './useOpenAIStream';

export const App: React.FC = () => {
  const [transcription, setTranscription] = useState<{
    text: string;
    segments: any[];
  } | null>(null);
  
  const [config, setConfig] = useState<OpenAIConfig>({
    model: 'gpt-4o-audio-preview',
    systemInstruction: 'You are a transcript editor. Output unified diff format.',
    temperature: 0.7,
    maxTokens: 4096,
    modalities: ['text']
  });
  
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [editCommand, setEditCommand] = useState('');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  
  const { startStream, isStreaming } = useOpenAIStream();
  
  const handleTranscribeComplete = (result: any) => {
    setTranscription(result);
    setOriginalText(result.transcript);
  };
  
  const handleEdit = () => {
    if (!transcription || !editCommand) return;
    
    setEditedText('');
    startStream(
      transcription.transcript,
      editCommand,
      audioBase64,
      config,
      {
        onChunk: (text) => setEditedText(prev => prev + text),
        onComplete: () => console.log('Edit complete'),
        onError: (error) => {
          alert(`Error: ${error.message}`);
          console.error(error);
        }
      }
    );
  };
  
  const handleAcceptChanges = () => {
    setOriginalText(editedText);
    setEditedText('');
  };
  
  return (
    <div className="app">
      <h1>AI Transcript Editor (OpenAI)</h1>
      
      <section className="upload-section">
        <AudioUploader onTranscribeComplete={handleTranscribeComplete} />
      </section>
      
      <section className="config-section">
        <ModelConfigPanel onConfigChange={setConfig} />
      </section>
      
      {transcription && (
        <section className="transcript-section">
          <h2>Transcript</h2>
          <div className="transcript-metadata">
            <span>Duration: {transcription.duration}s</span>
            <span>Words: {transcription.segments?.length || 0}</span>
          </div>
          
          <textarea 
            className="transcript-text"
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            rows={10}
          />
          
          <div className="edit-controls">
            <input 
              type="text"
              value={editCommand}
              onChange={(e) => setEditCommand(e.target.value)}
              placeholder="Enter editing command (e.g., 'Fix grammar and punctuation')"
              disabled={isStreaming}
            />
            <button onClick={handleEdit} disabled={isStreaming || !editCommand}>
              {isStreaming ? 'Processing...' : 'Generate Edit'}
            </button>
          </div>
          
          {editedText && (
            <section className="diff-section">
              <h2>Proposed Changes</h2>
              <MonacoDiffEditor
                original={originalText}
                modified={editedText}
                onAccept={handleAcceptChanges}
                onReject={() => setEditedText('')}
              />
            </section>
          )}
        </section>
      )}
    </div>
  );
};
```

---

## 9. Performance Optimization

### Audio Optimization

```javascript
// Optimal Whisper settings
const optimizeAudio = async (inputPath: string, outputPath: string) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate('16k')      // Minimize bandwidth
      .audioFrequency(12000)    // 12kHz sample rate
      .audioChannels(1)         // Mono
      .toFormat('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
};
```

### Caching Strategy

```typescript
// Cache transcripts to avoid re-transcription
const transcriptCache = new Map<string, string>();

const getCachedTranscript = (fileHash: string) => {
  return transcriptCache.get(fileHash);
};

const cacheTranscript = (fileHash: string, transcript: string) => {
  transcriptCache.set(fileHash, transcript);
  // Optionally persist to database
};
```

---

## 10. Key Differences: OpenAI vs. Gemini

| Feature | OpenAI | Gemini |
|---------|---------|---------|
| Audio file reuse | No (must re-send) | Yes (Files API, 48hrs) |
| Max audio size | 25MB (hard limit) | 2GB via Files API |
| Audio in context | No native support | Yes, built-in |
| Transcription model | Whisper (separate API) | Gemini handles natively |
| Audio output | GPT-4o audio preview | Not yet available |
| Rate limits (Tier 1) | 500 RPM, 30K TPM | 15 RPM (flash), 2 RPM (pro) |
| Pricing (audio) | $40/1M input tokens | $0.001/sec (~$3.6/hr) |

---

## Key Takeaways

1. **Backend proxy is mandatory**—never expose API keys
2. **Whisper has hard 25MB limit**—compress or chunk audio
3. **No native audio context retention**—store transcripts yourself
4. **Implement exponential backoff** for 429/500 errors
5. **Use rate limit headers** to prevent quota exhaustion
6. **GPT-4o audio preview supports audio I/O** for voice responses
7. **System instructions control diff output format**
8. **Monitor token usage**: audio = ~170 tokens/minute
9. **Optimize audio**: 16kbps MP3, 12kHz, mono for best performance
10. **Handle timeouts** (large files may take 60s+)

This architecture provides OpenAI-equivalent functionality to your Gemini implementation, with careful handling of OpenAI's limitations (particularly the 25MB Whisper limit and lack of persistent audio context).