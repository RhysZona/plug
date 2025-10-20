// OpenAI Service: Secure backend proxy for Whisper + GPT-4o Audio Preview
// SECURITY: All API calls routed through backend - NO API keys in frontend
// DEBUGGING: Ultra-detailed logging with eye-bleeding level of detail

import { 
  debug, info, warn, error, trace, fatal,
  startTimer, endTimer, logNetwork, logNetworkResponse, logFile 
} from './debugLogger';
import { configManager } from './configManager';

export interface OpenAIConfig {
  model: string;
  systemInstruction: string;
  temperature: number;        // 0.0-2.0
  maxTokens: number;          // Max: 16,384 for gpt-4o-audio-preview
  topP?: number;              // 0.0-1.0
  frequencyPenalty?: number;  // -2.0 to 2.0
  presencePenalty?: number;   // -2.0 to 2.0
  modalities: string[];       // ['text', 'audio']
  audio?: {
    voice: string;            // 'alloy', 'echo', 'shimmer'
    format: string;           // 'wav', 'mp3', 'opus'
  };
}

export interface TranscriptionResult {
  transcript: string;
  segments: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  duration: number;
}

export interface OpenAIModel {
  id: string;
  name: string;
  contextWindow: number;
  audioSupport: boolean;
  description: string;
}

class OpenAIService {
  private baseUrl: string;

  constructor() {
    info('OpenAIService', 'constructor', 'Initializing OpenAI service', {
      nodeEnv: process.env.NODE_ENV,
      production: process.env.NODE_ENV === 'production'
    });

    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? '' // Use relative URLs in production
      : 'http://localhost:3001'; // Backend URL for development

    info('OpenAIService', 'constructor', 'OpenAI service initialized', {
      baseUrl: this.baseUrl,
      location: window.location.href,
      timestamp: Date.now()
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * Hard limit: 25MB file size (enforced by backend)
   */
  async transcribeAudio(
    file: File, 
    language: string = 'en'
  ): Promise<TranscriptionResult> {
    const timerLabel = `transcribeAudio_${Date.now()}`;
    startTimer(timerLabel);
    
    info('OpenAIService', 'transcribeAudio', 'Starting audio transcription', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      language,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
    });

    logFile('transcribeAudio:validate', file, 'OpenAIService', { language });

    // Validate file before sending
    const validation = this.validateAudioFile(file);
    if (!validation.valid) {
      error('OpenAIService', 'transcribeAudio', 'File validation failed', {
        error: validation.error,
        file: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      });
      throw new Error(validation.error);
    }

    debug('OpenAIService', 'transcribeAudio', 'File validation passed', validation);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('language', language);

    const url = `${this.baseUrl}/api/openai/transcribe`;
    const requestId = logNetwork(url, 'POST', {}, formData);

    info('OpenAIService', 'transcribeAudio', 'Sending transcription request', {
      url,
      requestId,
      baseUrl: this.baseUrl,
      method: 'POST',
      language
    });

    try {
      // Get request config with headers for API key
      const requestConfig = configManager.getRequestConfig('openai');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: requestConfig.headers,
        body: formData
      });

      debug('OpenAIService', 'transcribeAudio', 'Response received', {
        requestId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        redirected: response.redirected,
        type: response.type
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        error('OpenAIService', 'transcribeAudio', 'HTTP error response', {
          requestId,
          status: response.status,
          statusText: response.statusText,
          errorData,
          headers: Object.fromEntries(response.headers.entries())
        });

        logNetworkResponse(requestId, response, errorData, new Error(errorData.error || 'HTTP Error'));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      const duration = endTimer(timerLabel);

      info('OpenAIService', 'transcribeAudio', 'Transcription completed successfully', {
        requestId,
        transcriptLength: result.transcript.length,
        duration: result.duration,
        segments: result.segments?.length || 0,
        processingTimeMs: duration,
        charactersPerSecond: result.transcript.length / (duration / 1000)
      });

      logNetworkResponse(requestId, response, result);
      
      return result;
    } catch (networkError: any) {
      const duration = endTimer(timerLabel);

      fatal('OpenAIService', 'transcribeAudio', 'Network request failed', {
        requestId,
        error: networkError.message,
        stack: networkError.stack,
        processingTimeMs: duration,
        url,
        baseUrl: this.baseUrl,
        networkState: {
          onLine: navigator.onLine,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt
          } : 'unknown'
        }
      });

      logNetworkResponse(requestId, {} as Response, null, networkError);
      
      // Handle specific error types with more detail
      if (networkError.message.includes('File too large')) {
        throw new Error('File too large. Maximum 25MB for Whisper API. Try compressing the audio.');
      }
      
      if (networkError.message.includes('Unsupported format')) {
        throw new Error('Unsupported audio format. Use MP3, WAV, MP4, or WEBM.');
      }

      if (networkError.message.includes('Failed to fetch')) {
        throw new Error(`Network connection failed. Check if backend server is running on ${this.baseUrl}. Original error: ${networkError.message}`);
      }
      
      throw networkError;
    }
  }

  /**
   * Stream GPT-4o editing responses with Server-Sent Events
   */
  async streamEdit(
    transcript: string,
    editCommand: string,
    config: OpenAIConfig,
    audioBase64?: string
  ): Promise<ReadableStream<string>> {
    try {
      // Get request config with headers for API key
      const requestConfig = configManager.getRequestConfig('openai');
      
      const response = await fetch(`${this.baseUrl}/api/openai/stream-edit`, {
        method: 'POST',
        headers: {
          ...requestConfig.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          editCommand,
          audioBase64,
          config
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      console.log(`✅ OpenAI Streaming started: ${config.model}, temp=${config.temperature}`);

      return new ReadableStream<string>({
        start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();

          const pump = async (): Promise<void> => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    if (data === '[DONE]') {
                      console.log('✅ OpenAI Streaming completed');
                      controller.close();
                      return;
                    }

                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.error) {
                        console.error('❌ OpenAI Streaming error:', parsed.error);
                        controller.error(new Error(parsed.error));
                        return;
                      }

                      if (parsed.text) {
                        controller.enqueue(parsed.text);
                      }
                    } catch (e) {
                      // Skip malformed JSON
                      console.warn('⚠️ OpenAI Streaming: JSON parse error, skipping chunk');
                    }
                  }
                }
              }
            } catch (error) {
              console.error('❌ OpenAI Streaming error:', error);
              controller.error(error);
            }
          };

          pump();
        }
      });
    } catch (error: any) {
      console.error('❌ OpenAI Stream setup failed:', error);
      throw error;
    }
  }

  /**
   * Get available OpenAI models
   */
  async getModels(): Promise<OpenAIModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/openai/models`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.models;
    } catch (error: any) {
      console.error('❌ OpenAI Models fetch failed:', error);
      throw error;
    }
  }

  /**
   * Validate audio file before upload
   */
  private validateAudioFile(file: File): { valid: boolean; error?: string } {
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

    // 25MB hard limit for Whisper API
    if (file.size > 25 * 1024 * 1024) {
      return {
        valid: false,
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: 25MB.`
      };
    }

    return { valid: true };
  }

  /**
   * Estimate tokens used by audio (rough calculation)
   * GPT-4o audio preview uses ~170 tokens per minute
   */
  estimateAudioTokens(durationSeconds: number): number {
    return Math.ceil(durationSeconds / 60 * 170);
  }

  /**
   * Check if context would exceed limits
   */
  checkContextLimit(transcript: string, audioDurationSeconds: number): {
    valid: boolean;
    totalTokens: number;
    error?: string;
  } {
    const textTokens = Math.ceil(transcript.length / 4); // Rough estimate
    const audioTokens = this.estimateAudioTokens(audioDurationSeconds);
    const totalTokens = textTokens + audioTokens;
    
    // GPT-4o audio preview has 128K context window
    // Leave buffer for system instructions and output
    const contextLimit = 120000;
    
    if (totalTokens > contextLimit) {
      return {
        valid: false,
        totalTokens,
        error: `Context too large: ${totalTokens.toLocaleString()} tokens. Maximum: ${contextLimit.toLocaleString()}. Try shortening the transcript or audio.`
      };
    }
    
    return { valid: true, totalTokens };
  }

  /**
   * Get default system instruction for different use cases
   */
  getSystemInstruction(type: 'transcript_editor' | 'json_formatter' | 'diff_generator'): string {
    const instructions = {
      transcript_editor: `You are a professional transcript editor.

OUTPUT FORMAT: Generate changes in unified diff format:
--- original.txt
+++ edited.txt
@@ -line_number,count +line_number,count @@
-removed line
+added line
 unchanged line

RULES:
1. Output ONLY the diff, no explanations
2. Preserve line numbers and speaker labels if present
3. Group related changes into hunks
4. Do NOT add markdown formatting or code blocks
5. Use context lines between changes`,

      json_formatter: `You are a JSON formatter. Output ONLY valid JSON. No markdown, no code blocks, no explanations.

Schema: { "text": string, "confidence": number }`,

      diff_generator: `You are a code/text diff generator. Use git diff unified format. Include 3 lines of context. Mark additions with + and removals with -.`
    };

    return instructions[type];
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();