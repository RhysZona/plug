import React, { useEffect, useRef } from 'react';
import { XIcon, ChevronUpIcon, ChevronDownIcon } from './icons/Icons';

interface FindReplaceBarProps {
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    replaceQuery: string;
    onReplaceQueryChange: (query: string) => void;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    onReplace: () => void;
    onReplaceAll: () => void;
    matchesCount: number;
    currentMatchNumber: number;
}

export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({
    searchQuery, onSearchQueryChange, replaceQuery, onReplaceQueryChange,
    onClose, onNext, onPrev, onReplace, onReplaceAll,
    matchesCount, currentMatchNumber
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                onPrev();
            } else {
                onNext();
            }
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onReplace();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    }

    const canReplace = matchesCount > 0;

    return (
        <div className="absolute top-2 right-2 bg-gray-700 rounded-lg shadow-lg z-20 flex flex-col items-start p-2 border border-gray-600 text-sm gap-2 w-[450px]">
            {/* Find Row */}
            <div className="flex items-center gap-2 w-full">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Find..."
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    onKeyDown={handleFindKeyDown}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-2 py-1 focus:ring-brand-blue focus:border-brand-blue outline-none"
                />
                <span className="text-gray-400 w-24 text-center font-mono">
                    {matchesCount > 0 ? `${currentMatchNumber} / ${matchesCount}` : '0 / 0'}
                </span>
                <div className="flex items-center border-l border-gray-600 ml-auto pl-2">
                    <button onClick={onPrev} disabled={matchesCount === 0} className="p-1 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                        <ChevronUpIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onNext} disabled={matchesCount === 0} className="p-1 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-600 ml-2">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
            {/* Replace Row */}
            <div className="flex items-center gap-2 w-full">
                <input
                    type="text"
                    placeholder="Replace with..."
                    value={replaceQuery}
                    onChange={(e) => onReplaceQueryChange(e.target.value)}
                    onKeyDown={handleReplaceKeyDown}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-2 py-1 focus:ring-brand-blue focus:border-brand-blue outline-none"
                />
                <div className="flex items-center gap-2 ml-auto pl-2">
                    <button 
                        onClick={onReplace}
                        disabled={!canReplace}
                        className="px-3 py-1 rounded-md bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Replace
                    </button>
                    <button 
                        onClick={onReplaceAll}
                        disabled={!canReplace}
                        className="px-3 py-1 rounded-md bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Replace All
                    </button>
                </div>
            </div>
        </div>
    );
};
