import React, { useState } from 'react';
import { useUI } from '../contexts/UIContext';
import { XIcon } from './icons/Icons';
import APIKeySettings from './APIKeySettings';

const ShortcutInput: React.FC<{ label: string, value: string, onChange: (value: string) => void }> = ({ label, value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const parts: string[] = [];
        if (e.ctrlKey) parts.push('Control');
        if (e.metaKey) parts.push('Meta');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        
        const key = e.key === ' ' ? ' ' : e.key;
        if (!['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
            parts.push(key);
        }

        onChange(parts.join('+'));
        setIsEditing(false);
    };

    return (
        <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700/50">
            <span className="text-gray-300">{label}</span>
            <input
                type="text"
                value={value === ' ' ? 'Space' : value}
                readOnly
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={handleKeyDown}
                placeholder={isEditing ? "Press a key..." : ""}
                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 w-40 text-center font-mono cursor-pointer"
            />
        </div>
    );
};

export const SettingsModal: React.FC = () => {
    const { isSettingsOpen, setIsSettingsOpen, shortcuts, updateShortcuts } = useUI();
    const [activeTab, setActiveTab] = useState<'shortcuts' | 'apiKeys'>('shortcuts');
    const [showAPIKeySettings, setShowAPIKeySettings] = useState(false);
    
    if (!isSettingsOpen) return null;


    
    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700">
                    <header className="flex items-center justify-between p-4 border-b border-gray-700">
                        <h3 className="font-semibold text-lg">Settings</h3>
                        <button onClick={() => setIsSettingsOpen(false)} className="p-1 rounded-md hover:bg-gray-700"><XIcon className="w-5 h-5" /></button>
                    </header>
                    
                    {/* Tab Navigation */}
                    <div className="flex border-b border-gray-700">
                        <button
                            onClick={() => setActiveTab('shortcuts')}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'shortcuts'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-gray-300'
                            }`}
                        >
                            Keyboard Shortcuts
                        </button>
                        <button
                            onClick={() => setActiveTab('apiKeys')}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'apiKeys'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-gray-400 hover:text-gray-300'
                            }`}
                        >
                            🔑 API Keys
                        </button>
                    </div>

                    <div className="p-6">
                        {activeTab === 'shortcuts' && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-gray-400 mb-2">Keyboard Shortcuts</h4>
                                <ShortcutInput label="Play / Pause" value={shortcuts.playPause} onChange={val => updateShortcuts({...shortcuts, playPause: val})} />
                                <ShortcutInput label="Rewind 3s" value={shortcuts.rewind} onChange={val => updateShortcuts({...shortcuts, rewind: val})} />
                                <ShortcutInput label="Forward 3s" value={shortcuts.forward} onChange={val => updateShortcuts({...shortcuts, forward: val})} />
                                <ShortcutInput label="Undo" value={shortcuts.undo} onChange={val => updateShortcuts({...shortcuts, undo: val})} />
                                <ShortcutInput label="Redo" value={shortcuts.redo} onChange={val => updateShortcuts({...shortcuts, redo: val})} />
                                <ShortcutInput label="Interpolate Edits" value={shortcuts.interpolateEdits} onChange={val => updateShortcuts({...shortcuts, interpolateEdits: val})} />
                                <ShortcutInput label="Toggle Line Numbers" value={shortcuts.toggleLineNumbers} onChange={val => updateShortcuts({...shortcuts, toggleLineNumbers: val})} />
                            </div>
                        )}

                        {activeTab === 'apiKeys' && (
                            <div className="space-y-4">
                                <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-300 mb-2">🔑 API Key Configuration</h4>
                                    <p className="text-gray-300 text-sm mb-4">
                                        Configure your AI provider API keys for transcription and editing features. 
                                        Keys are stored securely in your browser's local storage.
                                    </p>
                                    <button
                                        onClick={() => setShowAPIKeySettings(true)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                                    >
                                        Configure API Keys
                                    </button>
                                </div>
                                
                                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
                                    <h5 className="font-medium text-yellow-300 mb-2">⚠️ Important Notes:</h5>
                                    <ul className="text-gray-300 text-sm space-y-1">
                                        <li>• API keys are stored locally in your browser</li>
                                        <li>• Keys are sent securely to backend server for API calls</li>
                                        <li>• No API keys are stored on remote servers</li>
                                        <li>• You can clear all data at any time</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showAPIKeySettings && (
                <APIKeySettings onClose={() => setShowAPIKeySettings(false)} />
            )}
        </>
    );
};