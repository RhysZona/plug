import React, { useState } from 'react';
import { useUI } from '../contexts/UIContext';
import { XIcon } from './icons/Icons';

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
    
    if (!isSettingsOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="font-semibold text-lg">Settings</h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-1 rounded-md hover:bg-gray-700"><XIcon className="w-5 h-5" /></button>
                </header>
                <div className="p-6">
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
                </div>
            </div>
        </div>
    );
};