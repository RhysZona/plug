import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import type { Speaker } from '../types';
import { XIcon } from './icons/Icons';

export const SpeakerEditorModal: React.FC = () => {
    const { speakerMap, handleSpeakerMapUpdate, handleSpeakerMerge } = useData();
    const { isSpeakerEditorOpen, setIsSpeakerEditorOpen } = useUI();

    const sortedSpeakers = useMemo(() => {
        return (Object.entries(speakerMap) as [string, Speaker][]).sort(([, a], [, b]) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [speakerMap]);

    const handleNameChange = (speakerId: string, newName: string) => {
        const newMap = { ...speakerMap, [speakerId]: { ...speakerMap[speakerId], name: newName } };
        handleSpeakerMapUpdate(newMap);
    };

    const handleColorChange = (speakerId: string, newColor: string) => {
        const newMap = { ...speakerMap, [speakerId]: { ...speakerMap[speakerId], color: newColor } };
        handleSpeakerMapUpdate(newMap);
    };

    const handleMerge = (fromId: string, toId: string) => {
        if (toId && fromId !== toId) {
            handleSpeakerMerge(fromId, toId);
        }
    };

    if (!isSpeakerEditorOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col h-[70vh]">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="font-semibold text-lg">Timeline Speaker Configuration</h3>
                    <button onClick={() => setIsSpeakerEditorOpen(false)} className="p-1 rounded-md hover:bg-gray-700"><XIcon className="w-5 h-5" /></button>
                </header>
                
                <div className="flex-1 p-6 space-y-4 overflow-y-auto scrollbar-thin">
                    {sortedSpeakers.length > 0 ? (
                        <div className="space-y-3">
                            {sortedSpeakers.map(([id, speaker]) => (
                                <div key={id} className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg">
                                    <div className="relative">
                                        <div className="w-8 h-8 rounded-full border-2 border-gray-600" style={{ backgroundColor: speaker.color }}></div>
                                        <input
                                            type="color"
                                            value={speaker.color}
                                            onChange={(e) => handleColorChange(id, e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            title="Change speaker color"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={speaker.name}
                                        onChange={(e) => handleNameChange(id, e.target.value)}
                                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-24 font-semibold focus:ring-brand-blue focus:border-brand-blue"
                                    />
                                    <div className="flex-1 text-sm text-gray-400">
                                        Original ID: <span className="font-mono">{id}</span>
                                    </div>
                                    <select
                                        onChange={(e) => handleMerge(id, e.target.value)}
                                        className="bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-brand-blue focus:border-brand-blue"
                                        value=""
                                    >
                                        <option value="">Merge with...</option>
                                        {sortedSpeakers.filter(([otherId]) => otherId !== id).map(([otherId, otherSpeaker]) => (
                                            <option key={otherId} value={otherId}>{otherSpeaker.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 pt-8">
                            No timeline speakers found. Upload a Pyannote diarization file to begin editing.
                        </div>
                    )}
                </div>
                 <footer className="p-4 border-t border-gray-700 text-center">
                   <p className="text-sm text-gray-400">Changes are saved automatically.</p>
                </footer>
            </div>
        </div>
    );
};