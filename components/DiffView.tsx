import React, { memo } from 'react';
import type { Diff } from '../types';
import { DiffType } from '../types';

interface DiffViewProps {
    diffs: Diff[];
}

export const DiffView: React.FC<DiffViewProps> = memo(({ diffs }) => {
    if (diffs.length === 0) {
        return <div className="text-gray-500 text-sm">No changes to display. Select a version to see diffs.</div>;
    }

    return (
        <div className="text-sm space-y-2 max-h-96 overflow-y-auto">
            {diffs.map((diff, index) => {
                if (diff.type === DiffType.UNCHANGED) return null;
                const text = diff.words.map(w => w.punctuated_word).join(' ');
                
                const styles = {
                    [DiffType.INSERTED]: 'bg-blue-900/50 border-l-2 border-blue-400 text-blue-300',
                    [DiffType.DELETED]: 'bg-red-900/50 border-l-2 border-red-400 text-red-300 line-through',
                };
                
                return (
                    <div key={index} className={`p-2 rounded ${styles[diff.type]}`}>
                        <span className="font-bold mr-2 uppercase">{diff.type}</span>
                        <p className="inline">{text}</p>
                    </div>
                );
            })}
        </div>
    );
});