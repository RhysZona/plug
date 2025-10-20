# Building Google AI Studio + VSCode Cline-Style Text Editor with Gemini API: Comprehensive Production Guide

Now I have comprehensive information about Gemini API usage for your use case. Let me compile this into a detailed response covering all aspects you requested.

## Architecture Overview

Your application requires four core components working together:

1. **Audio Upload & Transcription Layer (Files API)**
2. **Chat Context Management (Multi-turn conversations)**
3. **Streaming Response Handler (Real-time diff generation)**
4. **Diff Editor Integration (Accept/deny/auto-apply patches)**

The critical security requirement: Never expose API keys in React frontend. Use a Node.js backend proxy pattern.

## 1. Security Architecture: Backend Proxy Pattern

### Why Backend Proxy is Mandatory

Exposing your Gemini API key in React code (even in environment variables) is a major security vulnerability. API keys can be extracted from bundled JavaScript, leading to unauthorized usage and billing fraud.

### Recommended Architecture

```
[React Frontend] → [Node.js/Express Backend] → [Gemini API] 
```

### Backend Implementation (Express):

```javascript
// server.js
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import cors from 'cors';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// CRITICAL: API key ONLY on backend
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(cors({
  origin: process.env.FRONTEND_URL, // Whitelist your frontend
  credentials: true
}));

// Audio upload endpoint
app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    const audioBuffer = req.file.buffer;
    
    // Upload to Gemini Files API
    const uploadedFile = await ai.files.upload({
      file: audioBuffer,
      config: {
        mimeType: req.file.mimetype,
        displayName: req.file.originalname
      }
    });
    
    // Return file URI (not the raw file)
    res.json({
      fileUri: uploadedFile.uri,
      fileName: uploadedFile.name,
      mimeType: uploadedFile.mimeType
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Streaming transcription/editing endpoint
app.post('/api/stream-response', async (req, res) => {
  const { fileUri, prompt, systemInstruction, config } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    const response = await ai.models.generateContentStream({
      model: config.model || 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri, mimeType: 'audio/mp3' } },
            { text: prompt }
          ]
        }
      ],
      config: {
        systemInstruction,
        temperature: config.temperature || 0.7,
        topP: config.topP || 0.95,
        topK: config.topK || 40,
        maxOutputTokens: config.maxOutputTokens || 8192
      }
    });
    
    for await (const chunk of response) {
      res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.listen(3001, () => console.log('Backend running on port 3001'));
```

## 2. Audio Upload & Transcription Workflow

### Files API: Upload Audio for Reuse

The Files API is essential when:
- Total request size (audio + prompt) > 20 MB
- You want to reuse the same audio across multiple editing commands
- Audio files are automatically deleted after 48 hours

### React Frontend Upload Component:

```typescript
// AudioUploader.tsx
import React, { useState } from 'react';

interface UploadedAudio {
  fileUri: string;
  fileName: string;
  mimeType: string;
}

export const AudioUploader: React.FC<{
  onUploadComplete: (audio: UploadedAudio) => void
}> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate audio format
    const validFormats = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/flac'];
    if (!validFormats.includes(file.type)) {
      alert('Unsupported audio format. Use WAV, MP3, AAC, OGG, or FLAC');
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append('audio', file);
    
    try {
      const response = await fetch('http://localhost:3001/api/upload-audio', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      onUploadComplete(data);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Audio upload failed');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input 
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <span>Uploading...</span>}
    </div>
  );
};
```

### Transcription + Context Building

Once uploaded, use the file URI in subsequent requests:

```javascript
// First request: Transcription
const transcriptPrompt = "Generate a transcript of this audio.";

// Second request: Edit transcript using same file URI
const editPrompt = "Fix grammatical errors in the transcript you generated.";
```

Key advantage: Audio remains in Gemini's context for multiple editing rounds without re-uploading.

## 3. Model Configuration & System Instructions

### Available Models (As of 2025)

| Model | Context Window | Use Case |
|-------|---------------|----------|
| gemini-2.5-flash | 1M tokens | Fast transcription, quick edits |
| gemini-2.5-pro | 2M tokens | Complex text editing, reasoning |
| gemini-2.0-flash-exp | 1M tokens | Experimental features |

### Complete Configuration Object

```typescript
interface GeminiConfig {
  model: string;
  systemInstruction: string | string[];
  temperature: number;        // 0.0-2.0 (default: 1.0)
  topP: number;              // 0.0-1.0 (default: 0.95)
  topK: number;              // 1-40 (default: 40)
  maxOutputTokens: number;   // Max: 8192
  stopSequences?: string[];  // Stop generation on these strings
  responseMimeType?: string; // e.g., 'application/json'
}
```

### React Component for Model Settings:

```typescript
// ModelConfigPanel.tsx
import React, { useState } from 'react';

export const ModelConfigPanel: React.FC<{
  onConfigChange: (config: GeminiConfig) => void
}> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<GeminiConfig>({
    model: 'gemini-2.5-pro',
    systemInstruction: 'You are a professional text editor assistant.',
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192
  });
  
  const updateConfig = (field: keyof GeminiConfig, value: any) => {
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
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
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
      </label>
      
      <label>
        Top-P ({config.topP}):
        <input 
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={config.topP}
          onChange={(e) => updateConfig('topP', parseFloat(e.target.value))}
        />
      </label>
      
      <label>
        Top-K ({config.topK}):
        <input 
          type="number"
          min="1"
          max="40"
          value={config.topK}
          onChange={(e) => updateConfig('topK', parseInt(e.target.value))}
        />
      </label>
      
      <label>
        System Instruction:
        <textarea 
          rows={4}
          value={config.systemInstruction}
          onChange={(e) => updateConfig('systemInstruction', e.target.value)}
          placeholder="Define the AI's behavior and rules..."
        />
      </label>
    </div>
  );
};
```

### System Instruction Best Practices

```javascript
const systemInstructions = {
  transcriptionEditor: `You are a professional transcript editor.
  
RULES:
1. Generate edits in unified diff format (similar to git diff)
2. Use --- for original lines and +++ for new lines
3. Group related changes into hunks with @@ markers
4. Preserve line numbers and context
5. Do NOT explain changes, only output the diff
6. Use this format:

--- original.txt
+++ edited.txt
@@ -1,3 +1,3 @@
-Original line with error
+Corrected line without error

Unchanged line

Another unchanged line`,

  jsonFormatter: `You are a JSON formatting assistant. Output ONLY valid JSON. No explanations, no markdown code blocks.`,

  codeReviewer: `You are a code review assistant. Provide diffs for suggested improvements. Focus on: performance, readability, security.`
};
```

## 4. Streaming Response Handler

### Server-Sent Events (SSE) Pattern

### React Hook for Streaming:

```typescript
// useGeminiStream.ts
import { useState, useCallback } from 'react';

interface StreamOptions {
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export const useGeminiStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  
  const startStream = useCallback(async (
    prompt: string,
    fileUri: string,
    config: GeminiConfig,
    options: StreamOptions
  ) => {
    setIsStreaming(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/stream-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUri, prompt, systemInstruction: config.systemInstruction, config })
      });
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
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
              } else {
                options.onChunk(parsed.text);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
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

## 5. Diff Editor Integration

### Option 1: Monaco Editor (VSCode-like)

```bash
npm install @monaco-editor/react monaco-editor
```

```typescript
// DiffEditor.tsx
import React, { useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';

export const MonacoDiffEditor: React.FC<{
  original: string;
  modified: string;
  onAccept: () => void;
  onReject: () => void;
}> = ({ original, modified, onAccept, onReject }) => {
  const diffEditorRef = useRef<any>(null);
  
  const handleEditorDidMount = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;
  };
  
  return (
    <div>
      <div className="diff-actions">
        <button onClick={onAccept}>✓ Accept Changes</button>
        <button onClick={onReject}>✗ Reject Changes</button>
      </div>
      
      <DiffEditor
        height="500px"
        language="markdown"
        original={original}
        modified={modified}
        onMount={handleEditorDidMount}
        options={{
          renderSideBySide: false, // Inline diff (like VSCode)
          readOnly: false,
          minimap: { enabled: false },
          lineNumbers: 'on',
          renderIndicators: true
        }}
      />
    </div>
  );
};
```

### Option 2: React Diff Viewer (GitHub-style)

```bash
npm install @alexbruf/react-diff-viewer
```

```typescript
// GitHubStyleDiff.tsx
import React from 'react';
import ReactDiffViewer, { DiffMethod } from '@alexbruf/react-diff-viewer';
import '@alexbruf/react-diff-viewer/index.css';

export const GitHubStyleDiff: React.FC<{
  oldValue: string;
  newValue: string;
  onAccept: () => void;
}> = ({ oldValue, newValue, onAccept }) => {
  return (
    <div>
      <ReactDiffViewer
        oldValue={oldValue}
        newValue={newValue}
        splitView={false} // Inline view
        compareMethod={DiffMethod.LINES}
        useDarkTheme={false}
        leftTitle="Current Version"
        rightTitle="AI Suggested Edit"
      />
      <button onClick={onAccept}>Apply Changes</button>
    </div>
  );
};
```

### Applying Patches Programmatically

Use Google's diff-match-patch library (same as Cline uses):

```bash
npm install diff-match-patch
```

```typescript
// patchUtils.ts
import DiffMatchPatch from 'diff-match-patch';

export const applyPatch = (originalText: string, patchText: string): string => {
  const dmp = new DiffMatchPatch();
  
  // Parse patch
  const patches = dmp.patch_fromText(patchText);
  
  // Apply patch with fuzzy matching
  const [patchedText, results] = dmp.patch_apply(patches, originalText);
  
  // Check if all patches applied successfully
  const allSuccess = results.every((r: boolean) => r);
  if (!allSuccess) {
    throw new Error('Some patches failed to apply');
  }
  
  return patchedText;
};
```

## 6. Rate Limiting & Error Handling

### Common Gemini API Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 429 | Rate limit exceeded | Implement exponential backoff |
| 500 | Internal server error | Retry with backoff |
| 503 | Service overloaded | Wait longer, retry |
| 400 | Invalid request | Check parameters |
| 403 | Permission denied | Verify API key |

### Exponential Backoff Implementation

```typescript
// retryWithBackoff.ts
interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
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
      const isRetryable = [429, 500, 503].includes(error.status);
      
      if (!isRetryable || attempt === config.maxRetries - 1) {
        throw error;
      }
      
      // Log retry attempt
      console.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with jitter
      delay = Math.min(delay * config.multiplier + Math.random() * 1000, config.maxDelay);
    }
  }
  
  throw new Error('Max retries exceeded');
};

// Usage in backend
app.post('/api/stream-response', async (req, res) => {
  await retryWithBackoff(async () => {
    const response = await ai.models.generateContentStream({ /* ... */ });
    return response;
  });
});
```

### Rate Limits (Free Tier)

- **Gemini 2.5 Flash**: 15 RPM (requests per minute)
- **Gemini 2.5 Pro**: 2 RPM
- **Quota resets**: Every minute

### Best Practice: Implement a request queue on your backend:

```typescript
// requestQueue.ts
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequest = 0;
  private minInterval = 60000 / 15; // 15 RPM = 4 seconds between requests
  
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequest;
          
          if (timeSinceLastRequest < this.minInterval) {
            await new Promise(r => setTimeout(r, this.minInterval - timeSinceLastRequest));
          }
          
          this.lastRequest = Date.now();
          const result = await fn();
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
  
  private async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
    }
    
    this.processing = false;
  }
}

export const geminiQueue = new RequestQueue();
```

## 7. Common Pitfalls & Solutions

### ❌ PITFALL 1: Exposing API Keys in Frontend

**Solution**: Always use backend proxy

### ❌ PITFALL 2: Not Handling Empty Responses

Gemini sometimes returns empty responses due to safety filters.

**Solution**:

```typescript
if (!response.text || response.text.trim() === '') {
  // Increase temperature or rephrase prompt
  console.warn('Empty response - safety filter triggered');
}
```

### ❌ PITFALL 3: Files Not Processing

Files must be in ACTIVE state before use.

**Solution**:

```typescript
const waitForFileActive = async (fileName: string) => {
  let file = await ai.files.get({ name: fileName });
  
  while (file.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 2000));
    file = await ai.files.get({ name: fileName });
  }
  
  if (file.state === 'FAILED') {
    throw new Error('File processing failed');
  }
  
  return file;
};
```

### ❌ PITFALL 4: Not Parsing Diff Format Correctly

Gemini may not always output perfect unified diff format.

**Solution**: Use explicit instructions and validation:

```typescript
const systemInstruction = `Generate diffs in EXACTLY this format:
--- original.txt
+++ edited.txt
@@ -line_number,line_count +line_number,line_count @@
-removed line
+added line
 context line

CRITICAL: Do not include explanations or markdown formatting.`;
```

### ❌ PITFALL 5: Ignoring Token Limits

Audio uses 32 tokens per second. A 1-hour audio = 115,200 tokens.

**Solution**: Split long audio or use maxOutputTokens:

```typescript
const config = {
  maxOutputTokens: 8192, // Prevent token overflow
  // ...
};
```

## 8. Complete React Application Example

```typescript
// App.tsx
import React, { useState } from 'react';
import { AudioUploader } from './AudioUploader';
import { ModelConfigPanel } from './ModelConfigPanel';
import { MonacoDiffEditor } from './DiffEditor';
import { useGeminiStream } from './useGeminiStream';

export const App: React.FC = () => {
  const [audioFile, setAudioFile] = useState<UploadedAudio | null>(null);
  const [config, setConfig] = useState<GeminiConfig>({
    model: 'gemini-2.5-pro',
    systemInstruction: 'You are a transcript editor.',
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192
  });
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [prompt, setPrompt] = useState('');
  
  const { startStream, isStreaming } = useGeminiStream();
  
  const handleTranscribe = () => {
    if (!audioFile) return;
    
    startStream(
      'Generate a transcript of this audio.',
      audioFile.fileUri,
      config,
      {
        onChunk: (text) => setOriginalText(prev => prev + text),
        onComplete: () => console.log('Transcription complete'),
        onError: (error) => alert(`Error: ${error.message}`)
      }
    );
  };
  
  const handleEdit = () => {
    if (!audioFile || !prompt) return;
    
    setEditedText('');
    startStream(
      `${prompt}\n\nOriginal text:\n${originalText}`,
      audioFile.fileUri,
      config,
      {
        onChunk: (text) => setEditedText(prev => prev + text),
        onComplete: () => console.log('Edit complete'),
        onError: (error) => alert(`Error: ${error.message}`)
      }
    );
  };
  
  const handleAcceptChanges = () => {
    setOriginalText(editedText);
    setEditedText('');
  };
  
  return (
    <div className="app">
      <h1>AI Transcript Editor</h1>
      
      <div className="upload-section">
        <AudioUploader onUploadComplete={setAudioFile} />
        {audioFile && <span>✓ {audioFile.fileName}</span>}
      </div>
      
      <ModelConfigPanel onConfigChange={setConfig} />
      
      <button onClick={handleTranscribe} disabled={!audioFile || isStreaming}>
        {isStreaming ? 'Processing...' : 'Transcribe Audio'}
      </button>
      
      {originalText && (
        <>
          <div className="edit-controls">
            <input 
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter editing command (e.g., 'Fix grammar errors')"
            />
            <button onClick={handleEdit} disabled={isStreaming}>
              Generate Edit
            </button>
          </div>
          
          {editedText && (
            <MonacoDiffEditor
              original={originalText}
              modified={editedText}
              onAccept={handleAcceptChanges}
              onReject={() => setEditedText('')}
            />
          )}
        </>
      )}
    </div>
  );
};
```

## 9. Performance Optimization

### Caching Transcripts

```typescript
// Cache transcripts to avoid re-transcription
const transcriptCache = new Map<string, string>();

const getCachedTranscript = (fileUri: string) => {
  return transcriptCache.get(fileUri);
};

const cacheTranscript = (fileUri: string, transcript: string) => {
  transcriptCache.set(fileUri, transcript);
};
```

### Debounce Edit Requests

```typescript
import { debounce } from 'lodash';

const debouncedEdit = debounce(handleEdit, 1000);
```

### Use Web Workers for Diff Computation

```typescript
// diffWorker.ts
import DiffMatchPatch from 'diff-match-patch';

self.onmessage = (e) => {
  const { original, modified } = e.data;
  const dmp = new DiffMatchPatch();
  const diff = dmp.diff_main(original, modified);
  dmp.diff_cleanupSemantic(diff);
  
  self.postMessage({ diff });
};
```

## 10. Testing & Debugging

### Test Audio File Sizes

- **Small test**: 30 seconds (~1 MB)
- **Medium test**: 5 minutes (~10 MB)
- **Large test**: 1 hour (~100 MB)

### Debug Streaming Issues

```typescript
// Add detailed logging
const startStream = useCallback(async (...) => {
  console.log('Starting stream with config:', config);
  
  const response = await fetch(...);
  console.log('Response status:', response.status);
  console.log('Response headers:', response.headers);
  
  // Log each chunk
  options.onChunk((text) => {
    console.log('Received chunk:', text.length, 'chars');
  });
});
```

### Monitor API Usage

Track token usage in responses:

```typescript
console.log('Tokens used:', response.usageMetadata.totalTokenCount);
```

## Key Takeaways

1. **Never expose API keys in React—use backend proxy**
2. **Files API is mandatory for large audio files (>20MB)**
3. **Implement exponential backoff for 429/500/503 errors**
4. **Use rate limiting queues to avoid quota exhaustion**
5. **System instructions control diff output format**
6. **Monaco Editor provides VSCode-like diff UI**
7. **Stream responses for real-time feedback**
8. **Audio uses 32 tokens/second—plan token budgets accordingly**
9. **Files auto-delete after 48 hours**
10. **Test with different model configurations (temperature, topP, topK)**

This architecture mirrors Google AI Studio's functionality while adding VSCode Cline's diff application patterns. The backend proxy ensures security, while streaming provides real-time feedback. The diff editor gives users granular control over accepting/rejecting AI suggestions.

## Common Issues and Solutions from Production Usage

### Retry Logic Implementation

Based on real production issues, here's the tested retry logic pattern:

```python
from google.generativeai.types import RequestOptions
from google.api_core import retry

def submit_gemini_query(api_key, system_message, user_message, response_class):
    genai.configure(api_key=api_key)
    
    generation_config = {
        "temperature": 0,
        "max_output_tokens": 8192
    }
    
    model = genai.GenerativeModel(
        model_name="gemini-1.5-pro-latest",
        generation_config=generation_config,
        system_instruction=system_message
    )
    
    response = model.generate_content(user_message,
                                      request_options=RequestOptions(
                                        retry=retry.Retry(
                                            initial=10, 
                                            multiplier=2, 
                                            maximum=60, 
                                            timeout=300
                                        )
                                       )
                                    )
    
    return response.text
```

### Advanced Error Handling

```typescript
// Catch transient Gemini errors
function is_retryable(e) {
  if (retry.if_transient_error(e)) {
    // Good practice, but probably won't fire with the google-genai SDK
    return true;
  } else if (e instanceof genai.errors.ClientError && e.code === 429) {
    // Catch 429 quota exceeded errors
    return true;
  } else if (e instanceof genai.errors.ServerError && e.code === 503) {
    // Catch 503 model overloaded errors
    return true;
  } else {
    return false;
  }
}

// Usage with decorator pattern
@retry.Retry(predicate=is_retryable)
function do_stuff(...) {
  return client.models.generate_content(...).text;
}
```

### Diff Format Issues

Many production systems experience "invalid diff format" errors. The solution is strict system instructions:

```typescript
const strictDiffInstruction = `Generate diffs in EXACTLY this format:
--- original.txt
+++ edited.txt
@@ -1,3 +1,3 @@
-Original line with error
+Corrected line without error
 unchanged line

CRITICAL: 
- Use exactly 3 dashes (---) and 3 plus signs (+++)
- Include @@ line number markers
- Use single space for context lines
- No explanations or markdown formatting
- End with newline`;
```

### Handling Model-Specific Issues

Based on production feedback, `Gemini 2.0 Flash Thinking Experimental` has issues with diff format. Use model fallbacks:

```typescript
const modelFallback = async (prompt: string, config: GeminiConfig) => {
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'];
  
  for (const model of models) {
    try {
      const response = await generateContent({ ...config, model }, prompt);
      if (response.text && response.text.trim()) {
        return response;
      }
    } catch (error) {
      console.warn(`Model ${model} failed:`, error.message);
      continue;
    }
  }
  
  throw new Error('All models failed');
};
```

This comprehensive guide provides everything needed to build a production-ready Google AI Studio + VSCode Cline-style text editor with proper security, error handling, and performance optimization.