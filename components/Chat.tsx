import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { XIcon, SendIcon, BotIcon, UserIcon } from './icons/Icons';

interface ChatProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Chat: React.FC<ChatProps> = ({ isOpen, onClose }) => {
    const {
        // FIX: The property on ChatContextType is named chatHistory, not history.
        chatHistory,
        systemPrompt,
        setSystemPrompt,
        handleTranscriptionRequest,
        handleEditRequest
    } = useChat();

    const [input, setInput] = useState('');
    const chatBodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    // FIX: Update dependency array to use chatHistory.
    }, [chatHistory]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            handleTranscriptionRequest(input.trim());
            setInput('');
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="absolute top-0 right-0 m-4 w-[450px] h-[calc(100vh-80px)] max-h-[700px] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-40">
            <header className="flex items-center justify-between p-3 border-b border-gray-700">
                <h3 className="font-semibold text-lg">AI Assistant</h3>
                <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-700">
                    <XIcon className="w-5 h-5" />
                </button>
            </header>

            <div ref={chatBodyRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                {/* FIX: Map over chatHistory instead of history. */}
                {chatHistory.map((msg, index) => (
                     <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center shrink-0"><BotIcon className="w-5 h-5 text-white" /></div>}
                        <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-brand-blue text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                         {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center shrink-0"><UserIcon className="w-5 h-5 text-white" /></div>}
                    </div>
                ))}
            </div>

            <div className="p-3 border-t border-gray-700 space-y-3">
                <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1 block">System Prompt (for Edits)</label>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        rows={4}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-brand-blue focus:border-brand-blue"
                        placeholder="e.g., Remove filler words, correct grammar..."
                    />
                    <button
                        onClick={handleEditRequest}
                        className="w-full mt-2 bg-brand-green hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                    >
                        Apply Edits to Transcript
                    </button>
                </div>
                 <div className="border-t border-gray-700/50 pt-3">
                    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Prompt for new transcription..."
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2 focus:ring-brand-blue focus:border-brand-blue"
                        />
                        <button type="submit" className="p-2 bg-brand-blue rounded-lg text-white hover:bg-blue-600 transition-colors">
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};