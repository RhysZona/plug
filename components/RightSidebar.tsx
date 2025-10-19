
import React, { useState } from 'react';
import { BotIcon, ChevronDownIcon } from './icons/Icons';

interface RightSidebarProps {
    isOpen: boolean;
    onEditRequest: (systemPrompt: string) => void;
}

enum EditMode {
    Plan = 'Plan',
    Edit = 'Edit',
}

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen=false }) => {
    const [isCollapsed, setIsCollapsed] = useState(!defaultOpen);
    return (
        <div className="border-b border-gray-700">
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full flex justify-between items-center p-3 text-left font-semibold hover:bg-gray-700 transition-colors"
            >
                <span>{title}</span>
                <ChevronDownIcon className={`w-5 h-5 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            {!isCollapsed && <div className="p-3 bg-gray-900/50">{children}</div>}
        </div>
    );
};

export const RightSidebar: React.FC<RightSidebarProps> = ({ isOpen, onEditRequest }) => {
    const [systemPrompt, setSystemPrompt] = useState('Correct any spelling and grammatical errors. Remove all filler words like "um", "uh", and "like".');
    const [mode, setMode] = useState<EditMode>(EditMode.Plan);
    const [transcriptionStyle, setTranscriptionStyle] = useState('NSV');

    if (!isOpen) return null;

    const handleApply = () => {
        if (mode === EditMode.Edit) {
            onEditRequest(systemPrompt);
        } else {
            // In a real app, "Plan" would show a preview. Here we'll just log it.
            console.log("Plan requested with prompt:", systemPrompt);
            alert("Plan mode: Previews are shown in the console for this demo.");
        }
    };

    return (
        <aside className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col shrink-0">
             <div className="flex items-center space-x-2 p-3 border-b border-gray-700">
                <BotIcon className="w-6 h-6 text-brand-blue" />
                <h2 className="text-lg font-semibold">AI Editor Controls</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
                <CollapsibleSection title="Model Configuration" defaultOpen={true}>
                    <div className="space-y-4 text-sm">
                        <label className="block">
                            <span className="text-gray-400 font-medium">Transcription Style</span>
                             <select
                                value={transcriptionStyle}
                                onChange={(e) => setTranscriptionStyle(e.target.value)}
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-brand-blue focus:border-brand-blue"
                            >
                                <option value="NSV">Non-Strict Verbatim (NSV)</option>
                                <option value="SV">Strict Verbatim (SV)</option>
                            </select>
                        </label>
                    </div>
                </CollapsibleSection>
                <CollapsibleSection title="System Prompt" defaultOpen={true}>
                     <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        rows={8}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-brand-blue focus:border-brand-blue"
                        placeholder="e.g., Remove filler words, correct grammar..."
                    />
                </CollapsibleSection>
                <CollapsibleSection title="Plan & Edit" defaultOpen={true}>
                    <div className="space-y-4">
                        <div className="flex bg-gray-700 rounded-lg p-1">
                            <button
                                onClick={() => setMode(EditMode.Plan)}
                                className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${mode === EditMode.Plan ? 'bg-brand-blue text-white' : 'hover:bg-gray-600'}`}
                            >
                                Plan
                            </button>
                             <button
                                onClick={() => setMode(EditMode.Edit)}
                                className={`flex-1 p-2 rounded-md text-sm font-semibold transition-colors ${mode === EditMode.Edit ? 'bg-brand-blue text-white' : 'hover:bg-gray-600'}`}
                            >
                                Edit
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">
                            <strong>Plan:</strong> Preview changes and see metrics before applying.
                            <br/>
                            <strong>Edit:</strong> Apply changes directly to the transcript.
                        </p>
                    </div>
                </CollapsibleSection>
            </div>

            <div className="p-4 border-t border-gray-700">
                <button
                    onClick={handleApply}
                    className="w-full bg-brand-green hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    {mode === EditMode.Plan ? 'Generate Plan' : 'Apply Edits'}
                </button>
            </div>
        </aside>
    );
};
