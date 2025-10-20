import React, { useRef, useState, useCallback } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import DiffMatchPatch from 'diff-match-patch';

interface MonacoDiffEditorProps {
  original: string;
  modified: string;
  onAccept: () => void;
  onReject: () => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
}

interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
}

export const MonacoDiffEditor: React.FC<MonacoDiffEditorProps> = ({
  original,
  modified,
  onAccept,
  onReject,
  language = 'markdown',
  readOnly = true,
  height = '500px'
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
  const diffEditorRef = useRef<any>(null);

  const calculateDiffStats = useCallback((original: string, modified: string): DiffStats => {
    const dmp = new DiffMatchPatch();
    const diff = dmp.diff_main(original, modified);
    dmp.diff_cleanupSemantic(diff);

    let linesAdded = 0;
    let linesRemoved = 0;
    let linesModified = 0;

    diff.forEach(([operation, text]) => {
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      if (operation === 1) { // Addition
        linesAdded += lines.length;
      } else if (operation === -1) { // Deletion
        linesRemoved += lines.length;
      } else if (operation === 0) { // Equal
        // Check if this is part of a modification
        const nextDiff = diff[diff.indexOf([operation, text]) + 1];
        if (nextDiff && nextDiff[0] !== 0) {
          linesModified += Math.min(lines.length, 1);
        }
      }
    });

    return { linesAdded, linesRemoved, linesModified };
  }, []);

  React.useEffect(() => {
    const stats = calculateDiffStats(original, modified);
    setDiffStats(stats);
  }, [original, modified, calculateDiffStats]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    diffEditorRef.current = editor;
    
    // Configure Monaco editor theme and options
    monaco.editor.defineTheme('gemini-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1f2937',
        'editor.foreground': '#e5e7eb',
        'diffEditor.insertedTextBackground': '#059669aa',
        'diffEditor.removedTextBackground': '#dc2626aa',
        'diffEditor.insertedLineBackground': '#05966922',
        'diffEditor.removedLineBackground': '#dc262622'
      }
    });
    
    monaco.editor.setTheme('gemini-dark');

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onAccept();
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
      onReject();
    });

    editor.addCommand(monaco.KeyCode.Escape, () => {
      if (isFullScreen) {
        setIsFullScreen(false);
      }
    });
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const monacoOptions = {
    renderSideBySide: false, // Inline diff view
    readOnly,
    minimap: { enabled: false },
    lineNumbers: 'on' as const,
    renderIndicators: true,
    scrollBeyondLastLine: false,
    wordWrap: 'on' as const,
    automaticLayout: true,
    diffWordWrap: 'on' as const,
    ignoreTrimWhitespace: false,
    renderWhitespace: 'selection' as const,
    hideUnchangedRegions: {
      enabled: true,
      minimumMatchingCharacters: 3,
      contextLineCount: 3
    },
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8
    },
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
    lineHeight: 1.5
  };

  const containerClasses = isFullScreen 
    ? 'fixed inset-0 z-50 bg-gray-900' 
    : 'bg-gray-800 rounded-lg border border-gray-700';

  return (
    <div className={containerClasses}>
      {/* Header with stats and controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-6">
          <h3 className="text-lg font-medium text-gray-200">
            📝 AI Suggested Changes
          </h3>
          
          {diffStats && (
            <div className="flex items-center space-x-4 text-sm">
              {diffStats.linesAdded > 0 && (
                <div className="flex items-center space-x-1 text-green-400">
                  <span>+{diffStats.linesAdded}</span>
                  <span className="text-xs text-gray-400">added</span>
                </div>
              )}
              {diffStats.linesRemoved > 0 && (
                <div className="flex items-center space-x-1 text-red-400">
                  <span>-{diffStats.linesRemoved}</span>
                  <span className="text-xs text-gray-400">removed</span>
                </div>
              )}
              {diffStats.linesModified > 0 && (
                <div className="flex items-center space-x-1 text-yellow-400">
                  <span>~{diffStats.linesModified}</span>
                  <span className="text-xs text-gray-400">modified</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Keyboard shortcuts hint */}
          <div className="text-xs text-gray-500 hidden md:block">
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400">Ctrl+Enter</kbd> Accept •
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400 ml-1">Ctrl+R</kbd> Reject
          </div>
          
          {/* Full screen toggle */}
          <button
            onClick={toggleFullScreen}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullScreen ? '⤓' : '⤢'}
          </button>
        </div>
      </div>

      {/* Monaco Diff Editor */}
      <div className={isFullScreen ? 'h-[calc(100vh-8rem)]' : height}>
        <DiffEditor
          height="100%"
          language={language}
          original={original}
          modified={modified}
          onMount={handleEditorDidMount}
          options={monacoOptions}
          loading={
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="text-2xl mb-2">⏳</div>
                <div>Loading diff editor...</div>
              </div>
            </div>
          }
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-400">
            Review the changes above and choose an action:
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={onReject}
            className="
              px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium
              transition-colors focus:outline-none focus:ring-2 focus:ring-red-500
            "
          >
            ✗ Reject Changes
          </button>
          
          <button
            onClick={onAccept}
            className="
              px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium
              transition-colors focus:outline-none focus:ring-2 focus:ring-green-500
            "
          >
            ✓ Accept Changes
          </button>
        </div>
      </div>

      {/* Help text */}
      <div className="px-4 pb-4 text-xs text-gray-500">
        <div className="bg-gray-750 rounded p-3">
          <div className="font-medium mb-1">💡 Tips:</div>
          <ul className="space-y-1">
            <li>• Green highlights show additions, red shows deletions</li>
            <li>• Use <kbd className="bg-gray-600 px-1 rounded">Ctrl+F</kbd> to search within the diff</li>
            <li>• <kbd className="bg-gray-600 px-1 rounded">Ctrl+Enter</kbd> to quickly accept changes</li>
            <li>• Click the full-screen button for better visibility of large changes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};