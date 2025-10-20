// useOpenAIStream: React hook for GPT-4o streaming responses
// Handles Server-Sent Events with proper error handling and cleanup

import { useState, useCallback, useRef, useEffect } from 'react';
import { openaiService, OpenAIConfig } from '../services/openaiService';

export interface StreamOptions {
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export interface StreamState {
  isStreaming: boolean;
  error: Error | null;
  accumulatedText: string;
  tokenCount: number;
}

export const useOpenAIStream = () => {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    error: null,
    accumulatedText: '',
    tokenCount: 0
  });

  // Use ref to track if component is mounted (prevent state updates after unmount)
  const mountedRef = useRef(true);
  const streamRef = useRef<ReadableStream<string> | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (readerRef.current) {
        readerRef.current.cancel();
      }
    };
  }, []);

  const startStream = useCallback(async (
    transcript: string,
    editCommand: string,
    config: OpenAIConfig,
    options: StreamOptions,
    audioBase64?: string
  ) => {
    // Reset state
    if (mountedRef.current) {
      setState({
        isStreaming: true,
        error: null,
        accumulatedText: '',
        tokenCount: 0
      });
    }

    let accumulatedText = '';
    let tokenCount = 0;

    try {
      // Validate context limits before streaming
      const contextCheck = openaiService.checkContextLimit(transcript, 0); // No audio duration for now
      if (!contextCheck.valid) {
        throw new Error(contextCheck.error);
      }

      console.log(`🚀 Starting OpenAI stream: ${config.model}`);
      console.log(`📊 Context: ${contextCheck.totalTokens.toLocaleString()} tokens`);

      // Get stream from service
      const stream = await openaiService.streamEdit(
        transcript,
        editCommand,
        config,
        audioBase64
      );

      streamRef.current = stream;
      const reader = stream.getReader();
      readerRef.current = reader;

      // Process stream chunks
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ OpenAI stream completed');
          options.onComplete();
          break;
        }

        if (value && mountedRef.current) {
          accumulatedText += value;
          tokenCount += Math.ceil(value.length / 4); // Rough token estimation

          // Update state
          setState(prev => ({
            ...prev,
            accumulatedText,
            tokenCount
          }));

          // Call chunk callback
          options.onChunk(value);
        }
      }
    } catch (error: any) {
      console.error('❌ OpenAI stream error:', error);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error
        }));
      }

      // Handle specific error types with better messages
      let userFriendlyError = error;
      
      if (error.message.includes('Context too large')) {
        userFriendlyError = new Error(
          'Transcript is too long for the selected model. Try shortening it or using a model with larger context window.'
        );
      } else if (error.message.includes('Rate limit')) {
        userFriendlyError = new Error(
          'Rate limit reached. Please wait a moment before trying again.'
        );
      } else if (error.message.includes('Network')) {
        userFriendlyError = new Error(
          'Network error. Please check your connection and try again.'
        );
      }

      options.onError(userFriendlyError);
    } finally {
      // Cleanup
      if (readerRef.current) {
        readerRef.current.releaseLock();
        readerRef.current = null;
      }
      streamRef.current = null;

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isStreaming: false
        }));
      }
    }
  }, []);

  const stopStream = useCallback(() => {
    console.log('⏹️ Stopping OpenAI stream');
    
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current = null;
    }

    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        isStreaming: false
      }));
    }
  }, []);

  const resetStream = useCallback(() => {
    setState({
      isStreaming: false,
      error: null,
      accumulatedText: '',
      tokenCount: 0
    });
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
    resetStream
  };
};