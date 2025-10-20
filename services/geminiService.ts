import type { MatchedWord } from '../types';

// Ultra-detailed logging for Gemini Service debugging
import { 
  debug, info, warn, error, trace, fatal,
  startTimer, endTimer, logNetwork, logNetworkResponse, logFile 
} from './debugLogger';
import { configManager } from './configManager';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '' // Use relative URLs in production
  : 'http://localhost:3001/api';

/**
 * Transcribes an audio file using the backend proxy.
 * @param {File} file The audio file to transcribe.
 * @param {string} prompt A prompt to guide the transcription.
 * @returns {Promise<string>} The transcribed text.
 */
export const transcribe = async (file: File, prompt: string): Promise<string> => {
    const timerLabel = `geminiTranscribe_${Date.now()}`;
    startTimer(timerLabel);
    
    info('GeminiService', 'transcribe', 'Starting Gemini transcription', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
        API_BASE_URL
    });

    logFile('transcribe:start', file, 'GeminiService', { prompt });

    try {
        // 1. Upload the audio file to the backend
        const formData = new FormData();
        formData.append('audio', file);

        const uploadUrl = `${API_BASE_URL}/upload-audio`;
        const uploadRequestId = logNetwork(uploadUrl, 'POST', {}, formData);

        info('GeminiService', 'transcribe', 'Starting audio upload', {
            uploadUrl,
            requestId: uploadRequestId,
            fileName: file.name,
            fileSize: file.size
        });

        // Get request config with headers for API key
        const requestConfig = configManager.getRequestConfig('gemini');
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: requestConfig.headers,
            body: formData,
        });

        debug('GeminiService', 'transcribe', 'Upload response received', {
            requestId: uploadRequestId,
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            ok: uploadResponse.ok,
            headers: Object.fromEntries(uploadResponse.headers.entries()),
            url: uploadResponse.url
        });

        if (!uploadResponse.ok) {
            let errorData: any;
            try {
                errorData = await uploadResponse.json();
            } catch (parseError) {
                errorData = { error: `HTTP ${uploadResponse.status}: ${uploadResponse.statusText}` };
            }

            error('GeminiService', 'transcribe', 'Audio upload failed', {
                requestId: uploadRequestId,
                status: uploadResponse.status,
                statusText: uploadResponse.statusText,
                errorData,
                headers: Object.fromEntries(uploadResponse.headers.entries())
            });

            logNetworkResponse(uploadRequestId, uploadResponse, errorData, new Error(errorData.error || 'Upload failed'));
            throw new Error(`Audio upload failed: ${errorData.error || uploadResponse.statusText}`);
        }

        const uploadResult = await uploadResponse.json();
        const { fileUri } = uploadResult;
        
        info('GeminiService', 'transcribe', 'Audio upload successful', {
            requestId: uploadRequestId,
            fileUri,
            uploadResult
        });

        logNetworkResponse(uploadRequestId, uploadResponse, uploadResult);

        // 2. Request transcription from the backend using the uploaded file URI
        const transcribeUrl = `${API_BASE_URL}/generate-content`;
        const transcribeBody = {
            fileUri,
            prompt: `Transcribe this audio file. ${prompt}`,
            systemInstruction: 'You are a highly accurate audio transcription service.',
            config: {
                model: 'gemini-1.5-pro',
                temperature: 0.2,
            }
        };
        
        const transcribeRequestId = logNetwork(transcribeUrl, 'POST', { 'Content-Type': 'application/json' }, transcribeBody);

        info('GeminiService', 'transcribe', 'Starting Gemini transcription request', {
            transcribeUrl,
            requestId: transcribeRequestId,
            fileUri,
            model: 'gemini-1.5-pro',
            temperature: 0.2,
            promptLength: prompt.length
        });

        const transcribeResponse = await fetch(transcribeUrl, {
            method: 'POST',
            headers: {
                ...requestConfig.headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transcribeBody),
        });

        debug('GeminiService', 'transcribe', 'Transcription response received', {
            requestId: transcribeRequestId,
            status: transcribeResponse.status,
            statusText: transcribeResponse.statusText,
            ok: transcribeResponse.ok,
            headers: Object.fromEntries(transcribeResponse.headers.entries()),
            url: transcribeResponse.url
        });

        if (!transcribeResponse.ok) {
            let errorData: any;
            try {
                errorData = await transcribeResponse.json();
            } catch (parseError) {
                errorData = { error: `HTTP ${transcribeResponse.status}: ${transcribeResponse.statusText}` };
            }

            error('GeminiService', 'transcribe', 'Transcription request failed', {
                requestId: transcribeRequestId,
                status: transcribeResponse.status,
                statusText: transcribeResponse.statusText,
                errorData,
                headers: Object.fromEntries(transcribeResponse.headers.entries())
            });

            logNetworkResponse(transcribeRequestId, transcribeResponse, errorData, new Error(errorData.error || 'Transcription failed'));
            throw new Error(`Transcription failed: ${errorData.error || transcribeResponse.statusText}`);
        }

        const transcribeResult = await transcribeResponse.json();
        const { text } = transcribeResult;

        const processingTime = endTimer(timerLabel);

        debug('GeminiService', 'transcribe', 'Transcription result received', {
            requestId: transcribeRequestId,
            textLength: text?.length || 0,
            hasText: !!text,
            processingTimeMs: processingTime,
            transcribeResult
        });

        logNetworkResponse(transcribeRequestId, transcribeResponse, transcribeResult);

        if (!text || text.trim().length === 0) {
            const errorMsg = "Received empty response from the backend";
            
            error('GeminiService', 'transcribe', 'Empty transcription result', {
                requestId: transcribeRequestId,
                text,
                textLength: text?.length || 0,
                transcribeResult,
                errorMessage: errorMsg
            });
            
            throw new Error(errorMsg);
        }

        const finalText = text.trim();

        info('GeminiService', 'transcribe', 'Transcription completed successfully', {
            uploadRequestId,
            transcribeRequestId,
            finalTextLength: finalText.length,
            processingTimeMs: processingTime,
            charactersPerSecond: finalText.length / (processingTime / 1000),
            model: 'gemini-1.5-pro'
        });

        return finalText;
    } catch (networkError: any) {
        const processingTime = endTimer(timerLabel);

        fatal('GeminiService', 'transcribe', 'Transcription process failed', {
            error: networkError.message,
            stack: networkError.stack,
            processingTimeMs: processingTime,
            fileName: file.name,
            fileSize: file.size,
            API_BASE_URL,
            networkState: {
                onLine: navigator.onLine,
                connection: (navigator as any).connection ? {
                    effectiveType: (navigator as any).connection.effectiveType,
                    downlink: (navigator as any).connection.downlink,
                    rtt: (navigator as any).connection.rtt
                } : 'unknown'
            }
        });

        if (networkError.message.includes('Failed to fetch')) {
            throw new Error(`Network connection failed. Check if backend server is running on ${API_BASE_URL}. Original error: ${networkError.message}`);
        }
        
        throw new Error(`Transcription failed: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`);
    }
};

/**
 * Edits a transcript based on a system prompt using the backend proxy.
 * @param {MatchedWord[]} words The array of words representing the current transcript.
 * @param {string} systemPrompt The instructions for how to edit the transcript.
 * @returns {Promise<MatchedWord[]>} A new array of words representing the edited transcript.
 */
export const edit = async (words: MatchedWord[], systemPrompt: string): Promise<MatchedWord[]> => {
    if (words.length === 0) {
        return Promise.resolve([]);
    }

    try {
        const transcriptText = words.map(w => w.punctuated_word).join(' ');

        // Get request config with headers for API key
        const requestConfig = configManager.getRequestConfig('gemini');
        
        const editResponse = await fetch(`${API_BASE_URL}/generate-content`, {
            method: 'POST',
            headers: {
                ...requestConfig.headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: transcriptText,
                systemInstruction: `${systemPrompt}. Respond only with the edited transcript text. Do not add any explanation or comments.`,
                config: {
                    model: 'gemini-1.5-flash',
                    temperature: 0.5,
                }
            }),
        });

        if (!editResponse.ok) {
            const errorData = await editResponse.json();
            throw new Error(`Edit failed: ${errorData.error || editResponse.statusText}`);
        }

        const { text: editedText } = await editResponse.json();

        if (!editedText || editedText.trim().length === 0) {
            throw new Error("Received empty response from the backend");
        }

        // Convert the edited text back into the MatchedWord structure.
        // Timestamps are lost in this process and will be null.
        const newWords: MatchedWord[] = editedText.trim().split(/\s+/).filter(w => w).map((word, i) => ({
            number: i + 1,
            punctuated_word: word,
            cleaned_word: word.toLowerCase().replace(/[.,!?]/g, ''),
            start: null,
            end: null
        }));

        return newWords;
    } catch (error) {
        console.error("Error in edit function:", error);
        throw new Error(`Edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};