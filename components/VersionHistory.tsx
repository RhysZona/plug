import React, { memo } from 'react';
import type { TranscriptVersion } from '../types';
import { HistoryIcon } from './icons/Icons';

interface VersionHistoryProps {
    versions: TranscriptVersion[];
    currentVersionIndex: number;
    onSelectVersion: (index: number) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = memo(({ versions, currentVersionIndex, onSelectVersion }) => {
    if (versions.length === 0) {
        return <div className="text-gray-500 text-sm">No versions saved yet.</div>;
    }

    return (
        <ul className="space-y-2">
            {versions.map((version, index) => (
                <li key={index}>
                    <button
                        onClick={() => onSelectVersion(index)}
                        className={`w-full text-left p-2 rounded-md transition-colors flex items-center space-x-2 text-sm ${
                            index === currentVersionIndex
                                ? 'bg-brand-blue text-white font-semibold'
                                : 'hover:bg-gray-700'
                        }`}
                    >
                        <HistoryIcon className="w-4 h-4 shrink-0" />
                        <span>{version.name}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
});