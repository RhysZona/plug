// Backend Express server for secure Gemini API proxy + OpenAI API proxy
// Critical: API keys can be provided via headers or environment variables

// Optional environment variable loading (for backward compatibility)
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (error) {
  console.log('dotenv not available, using only request headers for API keys');
}

import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to get API key from request or environment
const getAPIKey = (req, envVarName, headerNames) => {
  // First try to get from headers
  for (const headerName of headerNames) {
    if (req.headers[headerName]) {
      return req.headers[headerName];
    }
  }
  
  // Fallback to environment variable
  return process.env[envVarName];
};

// Helper function to create AI instances with dynamic API keys
const createGeminiInstance = (apiKey) => {
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

const createOpenAIInstance = (apiKey) => {
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
};

// Legacy fallback: Default API keys from environment (for backward compatibility)
const defaultGeminiApiKey = process.env.GEMINI_API_KEY;
const defaultOpenaiApiKey = process.env.OPENAI_API_KEY;

console.log('🔧 API Key Configuration:');
console.log(`  Gemini (env): ${defaultGeminiApiKey ? 'Configured' : 'Not set'}`);
console.log(`  OpenAI (env): ${defaultOpenaiApiKey ? 'Configured' : 'Not set'}`);
console.log('  Note: API keys can also be provided via request headers');

// CORS configuration - Support multiple frontend ports
app.use(cors({
  origin: [
    'http://localhost:3000',  // Current frontend port from debug logs
    'http://localhost:5173',  // Vite default port  
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Enhanced request logging (based on research findings)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 [${timestamp}] ${req.method} ${req.path}`);
  console.log('📡 Headers:', {
    'content-type': req.headers['content-type'],
    'x-api-key': req.headers['x-api-key'] ? '***PRESENT***' : 'MISSING',
    'x-gemini-api-key': req.headers['x-gemini-api-key'] ? '***PRESENT***' : 'MISSING', 
    'x-openai-api-key': req.headers['x-openai-api-key'] ? '***PRESENT***' : 'MISSING',
    'origin': req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
  });
  console.log('🌐 Remote IP:', req.ip || req.connection.remoteAddress);
  if (Object.keys(req.query).length > 0) {
    console.log('🔎 Query params:', req.query);
  }
  next();
});

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

    // Get Gemini API key from request headers or environment
    const geminiApiKey = getAPIKey(req, 'GEMINI_API_KEY', ['x-gemini-api-key', 'x-api-key']);
    
    if (!geminiApiKey) {
      return res.status(401).json({ 
        error: 'Gemini API key required. Please configure in settings or set GEMINI_API_KEY environment variable.' 
      });
    }

    const genAI = createGeminiInstance(geminiApiKey);
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
    await waitForFileActive(uploadedFile.file.name, genAI);
    
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
const waitForFileActive = async (fileName, genAI) => {
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
    // Get Gemini API key from request headers or environment
    const geminiApiKey = getAPIKey(req, 'GEMINI_API_KEY', ['x-gemini-api-key', 'x-api-key']);
    
    if (!geminiApiKey) {
      return res.status(401).json({ 
        error: 'Gemini API key required. Please configure in settings or set GEMINI_API_KEY environment variable.' 
      });
    }

    const genAI = createGeminiInstance(geminiApiKey);
    
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

// ============================================================================
// OpenAI API Routes (Whisper + GPT-4o Audio Preview)
// ============================================================================

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const diskUpload = multer({ dest: uploadsDir });

// Helper function to convert WAV to MP3 using ffmpeg
const convertWavToMp3 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioChannels(1)          // Mono for smaller file size
      .audioFrequency(16000)     // 16kHz - optimal for speech
      .audioBitrate('64k')       // Good quality for speech
      .format('mp3')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
};

// Helper function to normalize WAV files
const normalizeWav = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('pcm_s16le')  // 16-bit PCM - most compatible
      .audioChannels(1)          // Mono
      .audioFrequency(16000)     // 16kHz
      .format('wav')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
};

// Whisper transcription endpoint
app.post('/api/openai/transcribe', diskUpload.single('audio'), async (req, res) => {
  let processedPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get OpenAI API key from request headers or environment
    const openaiApiKey = getAPIKey(req, 'OPENAI_API_KEY', ['x-openai-api-key', 'x-api-key']);
    
    if (!openaiApiKey) {
      return res.status(401).json({ 
        error: 'OpenAI API key required. Please configure in settings or set OPENAI_API_KEY environment variable.' 
      });
    }

    const openai = createOpenAIInstance(openaiApiKey);
    let audioPath = req.file.path;
    
    // Whisper API has 25MB file limit
    const stats = fs.statSync(audioPath);
    if (stats.size > 25 * 1024 * 1024) {
      fs.unlinkSync(audioPath); // Clean up
      return res.status(413).json({ 
        error: 'File too large. Maximum 25MB for Whisper API' 
      });
    }
    
    // Validate audio format
    const validMimeTypes = [
      'audio/mp3', 'audio/mpeg', 'audio/wav', 
      'audio/mp4', 'audio/webm', 'audio/m4a'
    ];
    
    if (!validMimeTypes.includes(req.file.mimetype)) {
      fs.unlinkSync(audioPath); // Clean up
      return res.status(400).json({
        error: `Unsupported format: ${req.file.mimetype}. Use MP3, WAV, MP4, or WEBM.`
      });
    }

    // Handle WAV files - convert to MP3 for better compatibility
    if (req.file.mimetype === 'audio/wav' || req.file.originalname.toLowerCase().endsWith('.wav')) {
      console.log(`Converting WAV file to MP3: ${req.file.originalname}`);
      
      try {
        // Try converting to MP3 first (more reliable with OpenAI)
        const mp3Path = `${audioPath}.mp3`;
        await convertWavToMp3(audioPath, mp3Path);
        
        // Clean up original WAV
        fs.unlinkSync(audioPath);
        audioPath = mp3Path;
        processedPath = mp3Path;
        
        console.log('Successfully converted WAV to MP3');
      } catch (ffmpegError) {
        console.warn('Failed to convert WAV to MP3, trying to normalize WAV instead:', ffmpegError.message);
        
        try {
          // Fallback: normalize the WAV file
          const normalizedPath = `${audioPath}_normalized.wav`;
          await normalizeWav(audioPath, normalizedPath);
          
          // Clean up original
          fs.unlinkSync(audioPath);
          audioPath = normalizedPath;
          processedPath = normalizedPath;
          
          console.log('Successfully normalized WAV file');
        } catch (normalizeError) {
          console.error('Failed to process WAV file:', normalizeError);
          // Continue with original file, might still work
        }
      }
    }
    
    console.log(`Transcribing audio file: ${req.file.originalname} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    
    const transcription = await retryWithBackoff(async () => {
      return await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        language: req.body.language || 'en',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });
    });
    
    // Clean up uploaded file
    fs.unlinkSync(audioPath);
    
    res.json({
      transcript: transcription.text,
      segments: transcription.words || [],
      duration: transcription.duration || 0
    });
  } catch (error) {
    // Clean up files in case of error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (processedPath && fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
    }
    
    console.error('OpenAI Transcription error:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'transcription_error'
    });
  }
});

// GPT-4o Audio Preview streaming endpoint
app.post('/api/openai/stream-edit', async (req, res) => {
  const { transcript, editCommand, audioBase64, config } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Get OpenAI API key from request headers or environment
    const openaiApiKey = getAPIKey(req, 'OPENAI_API_KEY', ['x-openai-api-key', 'x-api-key']);
    
    if (!openaiApiKey) {
      res.write(`data: ${JSON.stringify({ 
        error: 'OpenAI API key required. Please configure in settings or set OPENAI_API_KEY environment variable.',
        type: 'auth_error'
      })}\\n\\n`);
      res.end();
      return;
    }

    const openai = createOpenAIInstance(openaiApiKey);
    
    const messages = [
      {
        role: 'system',
        content: config.systemInstruction || 'You are a professional text editor. Generate unified diff format changes.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Original transcript: ${transcript}` },
          { type: 'text', text: `Edit command: ${editCommand}` }
        ]
      }
    ];
    
    // Add audio context if provided (for GPT-4o audio preview)
    if (audioBase64 && config.model === 'gpt-4o-audio-preview') {
      messages[1].content.push({
        type: 'input_audio',
        input_audio: {
          data: audioBase64,
          format: 'wav'
        }
      });
    }
    
    console.log(`Streaming edit with model: ${config.model || 'gpt-4o-audio-preview'}`);
    
    const stream = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        model: config.model || 'gpt-4o-audio-preview',
        modalities: config.modalities || ['text'],
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 4096,
        stream: true,
        ...(config.topP && { top_p: config.topP }),
        ...(config.frequencyPenalty && { frequency_penalty: config.frequencyPenalty }),
        ...(config.presencePenalty && { presence_penalty: config.presencePenalty })
      });
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
    console.error('OpenAI Streaming error:', error);
    res.write(`data: ${JSON.stringify({ 
      error: error.message,
      type: 'streaming_error'
    })}\n\n`);
    res.end();
  }
});

// Text-only editing endpoint (no transcription needed)
app.post('/api/openai/edit-text', async (req, res) => {
  const { text, instruction, model = 'gpt-4o', systemPrompt, temperature = 0.7 } = req.body;
  
  try {
    // Get OpenAI API key from request headers or environment
    const openaiApiKey = getAPIKey(req, 'OPENAI_API_KEY', ['x-openai-api-key', 'x-api-key']);
    
    if (!openaiApiKey) {
      return res.status(401).json({ 
        error: 'OpenAI API key required. Please configure in settings or set OPENAI_API_KEY environment variable.' 
      });
    }

    const openai = createOpenAIInstance(openaiApiKey);
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt || 'You are a professional text editor. Make the requested changes while preserving the overall structure and meaning.'
      },
      {
        role: 'user',
        content: `Text to edit:\n\n${text}\n\nInstruction: ${instruction}`
      }
    ];
    
    console.log(`Text editing with model: ${model}`);
    
    const completion = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        model: model,
        messages,
        temperature,
        max_tokens: 8192
      });
    });
    
    res.json({
      original: text,
      edited: completion.choices[0].message.content,
      model: model,
      usage: completion.usage
    });
  } catch (error) {
    console.error('OpenAI Text Edit error:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'text_edit_error'
    });
  }
});

// Gemini text-only editing endpoint
app.post('/api/gemini/edit-text', async (req, res) => {
  const { text, instruction, model = 'gemini-2.5-flash', systemPrompt, temperature = 0.7 } = req.body;
  
  try {
    // Get Gemini API key from request headers or environment
    const geminiApiKey = getAPIKey(req, 'GEMINI_API_KEY', ['x-gemini-api-key', 'x-api-key']);
    
    if (!geminiApiKey) {
      return res.status(401).json({ 
        error: 'Gemini API key required. Please configure in settings or set GEMINI_API_KEY environment variable.' 
      });
    }

    const genAI = createGeminiInstance(geminiApiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: model,
      systemInstruction: systemPrompt || 'You are a professional text editor. Make the requested changes while preserving the overall structure and meaning.'
    });

    const generationConfig = {
      temperature,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
    };

    const prompt = `Text to edit:\n\n${text}\n\nInstruction: ${instruction}`;
    
    console.log(`Gemini text editing with model: ${model}`);
    
    const result = await requestQueue.enqueue(() =>
      retryWithBackoff(async () => {
        const response = await geminiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        });
        return response.response;
      })
    );
    
    res.json({
      original: text,
      edited: result.text(),
      model: model,
      usageMetadata: result.usageMetadata
    });
  } catch (error) {
    console.error('Gemini Text Edit error:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'text_edit_error'
    });
  }
});

// OpenAI models endpoint
app.get('/api/openai/models', async (req, res) => {
  try {
    const models = [
      {
        id: 'gpt-4o-audio-preview',
        name: 'GPT-4o Audio Preview',
        contextWindow: 128000,
        audioSupport: true,
        description: 'Latest multimodal model with audio input/output'
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        audioSupport: false,
        description: 'Flagship text model'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        audioSupport: false,
        description: 'Fast and affordable'
      }
    ];
    
    res.json({ models });
  } catch (error) {
    console.error('Models endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('✅ Health check requested');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Detailed health check endpoint with system info
app.get('/api/health/detailed', (req, res) => {
  console.log('🔍 Detailed health check requested');
  
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    version: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV || 'development',
    port: PORT,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5173']
  };
  
  res.json(healthStatus);
});

// Enhanced error handling middleware (based on research)
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`\n❌ [${timestamp}] Backend Error on ${req.method} ${req.path}:`);
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    headers: req.headers,
    body: req.body
  });
  
  res.status(err.status || 500).json({
    error: err.message,
    timestamp,
    path: req.path,
    method: req.method
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`⚠️ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Endpoint not found', 
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Gemini + OpenAI API proxy server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`Gemini API Key configured: ${defaultGeminiApiKey ? 'Yes' : 'No'}`);
  console.log(`OpenAI API Key configured: ${defaultOpenaiApiKey ? 'Yes' : 'No'}`);
  console.log(`\n🌐 CORS Origins: http://localhost:3000, http://localhost:5173`);
  console.log(`📡 Enhanced logging enabled - all requests will be logged`);
  console.log(`✅ Backend server ready for frontend connections!\n`);
});