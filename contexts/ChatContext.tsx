import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useData } from './DataContext';
import type { ChatContextType, MatchedWord, TranscriptVersion } from '../types';
import { transcribe, edit } from '../services/geminiService';

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChat must be used within a ChatProvider');
    return context;
};

const loadInitialState = () => {
    try {
        const savedStateJSON = localStorage.getItem('autosave-chat-state');
        if (savedStateJSON) return JSON.parse(savedStateJSON);
    } catch (e) { console.error("Could not parse saved chat state", e); }
    return null;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initialSavedState = useRef(loadInitialState()).current;
    
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>(initialSavedState?.chatHistory || []);
    const [systemPrompt, setSystemPrompt] = useState(initialSavedState?.systemPrompt || 'Correct any spelling and grammatical errors. Remove all filler words like "um", "uh", and "like".');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    const { audioFile, audioFileName, currentTranscript, transcriptVersions, currentVersionIndex, setTranscriptVersions, setCurrentVersionIndex } = useData();
    
    useEffect(() => {
        const stateToSave = { chatHistory, systemPrompt };
        localStorage.setItem('autosave-chat-state', JSON.stringify(stateToSave));
    }, [chatHistory, systemPrompt]);

    useEffect(() => {
        if (initialSavedState) {
            if (audioFileName && !audioFile) {
                setChatHistory(prev => {
                    const restoreMessage = `Session restored. Please re-upload the audio file "${audioFileName}" to continue.`;
                    if (!prev.some(m => m.text === restoreMessage)) {
                        return [...prev, { role: 'model', text: restoreMessage }];
                    }
                    return prev;
                });
            }
        } else if (chatHistory.length === 0) {
            setChatHistory([{ role: 'model', text: 'Hello! How can I help you? To start, please upload an audio file and then ask me to transcribe it.' }]);
        }
    }, [audioFile, audioFileName]); // Run only when audio status changes

    const handleTranscriptionRequest = async (prompt: string) => {
        if (!audioFile) {
            setChatHistory(prev => [...prev, { role: 'model', text: 'Please upload an audio file first.' }]);
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Transcribing audio...');
        setChatHistory(prev => [...prev, { role: 'user', text: prompt }]);

        try {
            const transcriptText = await transcribe(audioFile, prompt);
            const words: MatchedWord[] = transcriptText.split(/\s+/).filter(w => w).map((word, i) => ({
                number: i + 1,
                punctuated_word: word,
                cleaned_word: word.toLowerCase().replace(/[.,!?]/g, ''),
                start: null, end: null
            }));
            
            if (words.length > 0) {
                const newVersion: TranscriptVersion = { name: "Round 1: AI Transcription", words };
                setTranscriptVersions([newVersion]);
                setCurrentVersionIndex(0);
                setChatHistory(prev => [...prev, { role: 'model', text: `Transcription complete. Please upload MFA and Pyannote files.` }]);
            }

        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'model', text: `Sorry, an error occurred: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditRequest = async () => {
        if (currentTranscript.length === 0) return;
        
        setIsLoading(true);
        setLoadingMessage('Applying edits...');
        setChatHistory(prev => [...prev, { role: 'user', text: `Applying edits with prompt: "${systemPrompt}"` }]);

        try {
            const editedWords = await edit(currentTranscript, systemPrompt);
            if (JSON.stringify(editedWords) !== JSON.stringify(currentTranscript)) {
                const newVersion: TranscriptVersion = {
                    name: `Round ${transcriptVersions.length + 1}: AI Edit`,
                    words: editedWords
                };
                setTranscriptVersions(prev => [...prev.slice(0, currentVersionIndex + 1), newVersion]);
                setCurrentVersionIndex(prev => prev + 1);
                setChatHistory(prev => [...prev, { role: 'model', text: "Edits applied." }]);
            } else {
                 setChatHistory(prev => [...prev, { role: 'model', text: "No edits were applied." }]);
            }
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'model', text: `Sorry, an error occurred: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };


    const value: ChatContextType = {
        chatHistory, systemPrompt, setSystemPrompt, isLoading, loadingMessage,
        handleTranscriptionRequest, handleEditRequest,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
