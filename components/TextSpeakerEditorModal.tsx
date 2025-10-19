import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import type { MatchedWord } from '../types';
import { XIcon } from './icons/Icons';
import { formatTimestamp } from '../services/processingService';

interface SpeakerOccurrence {
    startingWordIndex: number;
    text: string;
    timestamp: string | null;
}

export const TextSpeakerEditorModal: React.FC = () => {
    const { 
        currentTranscript, 
        handleReplaceAllSpeakerLabels, 
        handleReplaceSelectedSpeakerLabels 
    } = useData();
    const { isTextSpeakerEditorOpen, setIsTextSpeakerEditorOpen } = useUI();

    const [fromSpeaker, setFromSpeaker] = useState('');
    const [toSpeaker, setToSpeaker] = useState('');
    const [occurrences, setOccurrences] = useState<SpeakerOccurrence[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    const speakerLabels = useMemo(() => {
        const labels = new Set(currentTranscript.map(w => w.speakerLabel).filter((label): label is string => !!label));
        return Array.from(labels).sort();
    }, [currentTranscript]);

    useEffect(() => {
        if (speakerLabels.length > 0 && !fromSpeaker) {
            setFromSpeaker(speakerLabels[0]);
        } else if (!speakerLabels.includes(fromSpeaker) && speakerLabels.length > 0) {
            setFromSpeaker(speakerLabels[0]);
        } else if (speakerLabels.length === 0) {
            setFromSpeaker('');
        }
    }, [speakerLabels, fromSpeaker]);
    
    useEffect(() => {
        if (fromSpeaker) {
            const foundOccurrences: SpeakerOccurrence[] = [];
            let currentParagraph: MatchedWord[] = [];
            let startingIndex = 0;

            currentTranscript.forEach((word, index) => {
                // A new paragraph starts when a word has a speakerLabel
                if (word.speakerLabel && currentParagraph.length > 0) {
                    const firstWordOfParagraph = currentTranscript[startingIndex];
                    if (firstWordOfParagraph.speakerLabel === fromSpeaker) {
                        foundOccurrences.push({
                            startingWordIndex: startingIndex,
                            text: currentParagraph.map(w => w.punctuated_word).join(' '),
                            timestamp: firstWordOfParagraph.start !== null ? formatTimestamp(firstWordOfParagraph.start) : null,
                        });
                    }
                    // Reset for the new paragraph
                    currentParagraph = [];
                    startingIndex = index;
                }
                currentParagraph.push(word);
            });
            
            // Handle the very last paragraph in the transcript
            if (currentParagraph.length > 0) {
                 const firstWordOfParagraph = currentTranscript[startingIndex];
                 if (firstWordOfParagraph.speakerLabel === fromSpeaker) {
                      foundOccurrences.push({
                            startingWordIndex: startingIndex,
                            text: currentParagraph.map(w => w.punctuated_word).join(' '),
                            timestamp: firstWordOfParagraph.start !== null ? formatTimestamp(firstWordOfParagraph.start) : null,
                        });
                 }
            }
            
            setOccurrences(foundOccurrences);
            setSelectedIndices([]); // Reset selection when speaker changes
        } else {
            setOccurrences([]);
            setSelectedIndices([]);
        }
    }, [fromSpeaker, currentTranscript]);


    const handleReplaceAll = () => {
        if (fromSpeaker && toSpeaker.trim() && fromSpeaker !== toSpeaker.trim()) {
            handleReplaceAllSpeakerLabels(fromSpeaker, toSpeaker.trim());
        }
    };

    const handleReplaceSelected = () => {
        if (selectedIndices.length > 0 && toSpeaker.trim()) {
            handleReplaceSelectedSpeakerLabels(selectedIndices, toSpeaker.trim());
        }
    };

    const handleSelectionChange = (index: number) => {
        setSelectedIndices(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index) 
                : [...prev, index]
        );
    };

    if (!isTextSpeakerEditorOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col h-[80vh]">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="font-semibold text-lg">Text Speaker Configuration</h3>
                    <button onClick={() => setIsTextSpeakerEditorOpen(false)} className="p-1 rounded-md hover:bg-gray-700"><XIcon className="w-5 h-5" /></button>
                </header>
                
                <div className="p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
                    {speakerLabels.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label htmlFor="from-speaker" className="block text-sm font-medium text-gray-400 mb-1">Choose speaker</label>
                                    <select
                                        id="from-speaker"
                                        value={fromSpeaker}
                                        onChange={(e) => setFromSpeaker(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-brand-blue focus:border-brand-blue"
                                    >
                                        {speakerLabels.map(label => <option key={label} value={label}>{label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="to-speaker" className="block text-sm font-medium text-gray-400 mb-1">Change to</label>
                                    <input
                                        id="to-speaker"
                                        type="text"
                                        value={toSpeaker}
                                        onChange={(e) => setToSpeaker(e.target.value)}
                                        placeholder="Enter new speaker label"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-brand-blue focus:border-brand-blue"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Occurrences</label>
                                <div className="bg-gray-900/50 p-3 rounded-md flex-1 overflow-y-auto scrollbar-thin">
                                    {occurrences.length > 0 ? (
                                        <ul className="space-y-3">
                                            {occurrences.map((occ) => (
                                                <li key={occ.startingWordIndex} className="flex items-start gap-3 p-2 rounded-md hover:bg-gray-700/50">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIndices.includes(occ.startingWordIndex)}
                                                        onChange={() => handleSelectionChange(occ.startingWordIndex)}
                                                        className="mt-1 h-4 w-4 rounded bg-gray-600 border-gray-500 text-brand-blue focus:ring-brand-blue cursor-pointer"
                                                    />
                                                    <div className="flex-1">
                                                        {occ.timestamp && <span className="font-mono text-xs text-brand-blue block">{occ.timestamp}</span>}
                                                        <p className="text-gray-300 text-sm">{occ.text}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-500">
                                            No text found for this speaker.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                            No speaker labels found in the transcript to edit.
                        </div>
                    )}
                </div>

                <footer className="p-4 border-t border-gray-700 flex justify-end gap-3">
                    <button 
                        onClick={handleReplaceSelected}
                        disabled={selectedIndices.length === 0 || !toSpeaker.trim() || fromSpeaker === toSpeaker.trim()}
                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        Replace Selected ({selectedIndices.length})
                    </button>
                    <button 
                        onClick={handleReplaceAll}
                        disabled={!fromSpeaker || !toSpeaker.trim() || fromSpeaker === toSpeaker.trim()}
                        className="bg-brand-blue hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        Replace All ({occurrences.length})
                    </button>
                </footer>
            </div>
        </div>
    );
};