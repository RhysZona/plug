import React, { memo } from 'react';
import { useUI } from '../contexts/UIContext';
import { PanelLeftIcon, MessageSquareIcon, BotIcon, SettingsIcon, UsersIcon, EditTextIcon } from './icons/Icons';

export const Header: React.FC = memo(() => {
    const { 
        setLeftSidebarOpen, 
        setChatOpen, 
        setIsSettingsOpen, 
        setIsSpeakerEditorOpen, 
        setIsTextSpeakerEditorOpen 
    } = useUI();

    return (
        <header className="flex items-center justify-between bg-gray-800 p-2 border-b border-gray-700 shadow-md h-14 shrink-0 relative z-30">
            <div className="flex items-center space-x-2">
                <button onClick={() => setLeftSidebarOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue">
                    <PanelLeftIcon className="w-5 h-5" />
                </button>
                 <div className="flex items-center space-x-3">
                   <BotIcon className="w-7 h-7 text-brand-blue" />
                    <h1 className="text-xl font-bold text-gray-100 tracking-tight">Gemini Transcription AI Editor</h1>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                 <button onClick={() => setIsSpeakerEditorOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="Timeline Speaker Configuration">
                    <UsersIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setIsTextSpeakerEditorOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="Text Speaker Configuration">
                    <EditTextIcon className="w-5 h-5" />
                </button>
                 <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="Settings">
                    <SettingsIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setChatOpen(prev => !prev)} className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-blue" title="AI Assistant">
                    <MessageSquareIcon className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
});