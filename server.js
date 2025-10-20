// Backend Express server for secure Gemini API proxy
// Critical: API keys are never exposed to frontend
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// CRITICAL: API key ONLY on backend
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default port
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Request queue for rate limiting
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequest = 0;
    this.minInterval = 60000 / 15; // 15 RPM = 4 seconds between requests for free tier
  }

  async enqueue(fn) {
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

  async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      await fn();
    }
    
    this.processing = false;
  }
}

const requestQueue = new RequestQueue();

// Retry logic with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 5) => {
  let delay = 1000;
  const maxDelay = 60000;
  const multiplier = 2;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = [429, 500, 503].includes(error.status);
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * multiplier + Math.random() * 1000, maxDelay);
    }
  }
};

// Audio upload endpoint
app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioBuffer = req.file.buffer;
    
    // Upload to Gemini Files API with retry logic
    const uploadedFile = await requestQueue.enqueue(() =>
      retryWithBackoff(async () => {
        const fileManager = genAI.fileManager;
        return await fileManager.uploadFile(audioBuffer, {
          mimeType: req.file.mimetype,
          displayName: req.file.originalname
        });
      })
    );
    
    // Wait for file to be processed
    await waitForFileActive(uploadedFile.file.name);
    
    res.json({
      fileUri: uploadedFile.file.uri,
      fileName: uploadedFile.file.name,
      mimeType: uploadedFile.file.mimeType
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Wait for file to be in ACTIVE state
const waitForFileActive = async (fileName) => {
  const fileManager = genAI.fileManager;
  let file = await fileManager.getFile(fileName);
  
  while (file.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 2000));
    file = await fileManager.getFile(fileName);
  }
  
  if (file.state === 'FAILED') {
    throw new Error('File processing failed');
  }
  
  return file;
};

// Streaming response endpoint with SSE
app.post('/api/stream-response', async (req, res) => {
  const { fileUri, prompt, systemInstruction, config } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    await requestQueue.enqueue(() =>
      retryWithBackoff(async () => {
        const model = genAI.getGenerativeModel({
          model: config.model || 'gemini-2.5-pro',
          systemInstruction: systemInstruction
        });

        const generationConfig = {
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.95,
          topK: config.topK || 40,
          maxOutputTokens: config.maxOutputTokens || 8192,
          ...(config.stopSequences && { stopSequences: config.stopSequences }),
          ...(config.responseMimeType && { responseMimeType: config.responseMimeType })
        };

        const parts = [{ text: prompt }];
        if (fileUri) {
          parts.unshift({
            fileData: {
              fileUri: fileUri,
              mimeType: 'audio/mp3' // Adjust based on actual file type
            }
          });
        }

        const result = await model.generateContentStream({
          contents: [{
            role: 'user',
            parts: parts
          }],
          generationConfig
        });
        
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            res.write(`data: ${JSON.stringify({ text: chunkText })}\\n\\n`);
          }
        }
        
        res.write('data: [DONE]\\n\\n');
      })
    );
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\\n\\n`);
  } finally {
    res.end();
  }
});

// Non-streaming response endpoint (for compatibility)
app.post('/api/generate-content', async (req, res) => {
  const { fileUri, prompt, systemInstruction, config } = req.body;
  
  try {
    const result = await requestQueue.enqueue(() =>
      retryWithBackoff(async () => {
        const model = genAI.getGenerativeModel({
          model: config.model || 'gemini-2.5-pro',
          systemInstruction: systemInstruction
        });

        const generationConfig = {
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.95,
          topK: config.topK || 40,
          maxOutputTokens: config.maxOutputTokens || 8192
        };

        const parts = [{ text: prompt }];
        if (fileUri) {
          parts.unshift({
            fileData: {
              fileUri: fileUri,
              mimeType: 'audio/mp3'
            }
          });
        }

        const response = await model.generateContent({
          contents: [{
            role: 'user',
            parts: parts
          }],
          generationConfig
        });
        
        return response.response;
      })
    );
    
    res.json({
      text: result.text(),
      usageMetadata: result.usageMetadata
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Gemini API proxy server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`API Key configured: ${apiKey ? 'Yes' : 'No'}`);
});