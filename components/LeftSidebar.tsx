

import React, { useState } from 'react';
import type { TranscriptVersion } from '../types';
import { ChevronDownIcon } from './icons/Icons';
import { VersionHistory } from './VersionHistory';

interface LeftSidebarProps {
    isOpen: boolean;
    versions: TranscriptVersion[];
    currentVersionIndex: number;
    onSelectVersion: (index: number) => void;
}

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
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

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ isOpen, versions, currentVersionIndex, onSelectVersion }) => {
    if (!isOpen) return null;

    return (
        <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-y-auto shrink-0">
            <CollapsibleSection title="Version History">
                <VersionHistory versions={versions} currentVersionIndex={currentVersionIndex} onSelectVersion={onSelectVersion} />
            </CollapsibleSection>
        </aside>
    );
};