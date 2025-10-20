import { useState, useCallback } from 'react';

export interface GeminiConfig {
  model: string;
  systemInstruction: string | string[];
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  stopSequences?: string[];
  responseMimeType?: string;
}

interface StreamOptions {
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export const useGeminiStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  
  const startStream = useCallback(async (
    prompt: string,
    config: GeminiConfig,
    options: StreamOptions,
    fileUri?: string
  ) => {
    setIsStreaming(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/stream-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileUri, 
          prompt, 
          systemInstruction: config.systemInstruction, 
          config 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Stream request failed');
      }
      
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
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                options.onError(new Error(parsed.error));
                return;
              } else if (parsed.text) {
                options.onChunk(parsed.text);
              }
            } catch (e) {
              console.debug('JSON parse error (ignored):', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      options.onError(error as Error);
    } finally {
      setIsStreaming(false);
    }
  }, []);
  
  const generateContent = useCallback(async (
    prompt: string,
    config: GeminiConfig,
    fileUri?: string
  ): Promise<{ text: string; usageMetadata?: any }> => {
    try {
      const response = await fetch('http://localhost:3001/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileUri, 
          prompt, 
          systemInstruction: config.systemInstruction, 
          config 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Generation error:', error);
      throw error;
    }
  }, []);
  
  return { 
    startStream, 
    generateContent,
    isStreaming 
  };
};