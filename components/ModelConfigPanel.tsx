import React, { useState } from 'react';
import { GeminiConfig } from '../hooks/useGeminiStream';

interface ModelConfigPanelProps {
  config: GeminiConfig;
  onConfigChange: (config: GeminiConfig) => void;
  disabled?: boolean;
}

const systemInstructions = {
  transcriber: `You are an expert transcriber. Generate accurate transcripts with proper punctuation, capitalization, and paragraph breaks. Include speaker labels when multiple speakers are present. Format as: "SPEAKER_NAME: [speech content]"`,
  
  transcriptionEditor: `You are a professional transcript editor. Generate edits in unified diff format (similar to git diff).

RULES:
1. Use --- for original lines and +++ for new lines
2. Group related changes into hunks with @@ markers
3. Preserve line numbers and context
4. Do NOT explain changes, only output the diff
5. Use this format:

--- original.txt
+++ edited.txt
@@ -1,3 +1,3 @@
-Original line with error
+Corrected line without error
 Unchanged line
 Another unchanged line`,

  jsonFormatter: `You are a JSON formatting assistant. Output ONLY valid JSON. No explanations, no markdown code blocks, no additional text. Just clean, properly formatted JSON.`,
  
  codeReviewer: `You are a code review assistant. Provide diffs for suggested improvements. Focus on: performance, readability, security. Generate clean unified diff format without explanations.`,
  
  custom: ''
};

const availableModels = [
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Best for complex reasoning and analysis' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast responses, good for simple tasks' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Balanced performance and quality' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Fastest responses, basic tasks' }
];

const tokenOptions = [1024, 2048, 4096, 8192];

export const ModelConfigPanel: React.FC<ModelConfigPanelProps> = ({
  config,
  onConfigChange,
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBasicSettings, setShowBasicSettings] = useState(true);
  const [showSystemInstructions, setShowSystemInstructions] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [activePreset, setActivePreset] = useState<keyof typeof systemInstructions>('custom');

  const updateConfig = <K extends keyof GeminiConfig>(field: K, value: GeminiConfig[K]) => {
    const newConfig = { ...config, [field]: value };
    onConfigChange(newConfig);
  };

  const handlePresetChange = (presetKey: keyof typeof systemInstructions) => {
    setActivePreset(presetKey);
    if (presetKey !== 'custom') {
      updateConfig('systemInstruction', systemInstructions[presetKey]);
    }
  };

  const handleSystemInstructionChange = (value: string) => {
    updateConfig('systemInstruction', value);
    // If user is typing custom instructions, mark as custom
    if (value !== systemInstructions[activePreset]) {
      setActivePreset('custom');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <div className="text-sm">⚙️</div>
          <div>
            <h3 className="text-sm font-medium text-gray-200">Model Config</h3>
            <p className="text-xs text-gray-400">
              {availableModels.find(m => m.value === config.model)?.label || config.model} • T:{config.temperature} • {config.maxOutputTokens}
            </p>
          </div>
        </div>
        <div className={`transform transition-transform text-xs text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-700">
          
          {/* Basic Settings Section */}
          <div>
            <div 
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-750 transition-colors border-b border-gray-700"
              onClick={() => setShowBasicSettings(!showBasicSettings)}
            >
              <h4 className="text-sm font-medium text-gray-300">Basic Settings</h4>
              <div className={`transform transition-transform text-xs text-gray-400 ${showBasicSettings ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </div>
            
            {showBasicSettings && (
              <div className="p-4 space-y-4">
                {/* Model Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Model
                  </label>
                  <select
                    value={config.model}
                    onChange={(e) => updateConfig('model', e.target.value)}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
                  >
                    {availableModels.map(model => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Temperature & Tokens in one row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-gray-400">Temperature</label>
                      <span className="text-xs text-brand-blue font-medium">{config.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                      disabled={disabled}
                      className="w-full slider"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Max Tokens</label>
                    <select
                      value={config.maxOutputTokens}
                      onChange={(e) => updateConfig('maxOutputTokens', parseInt(e.target.value))}
                      disabled={disabled}
                      className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
                    >
                      {tokenOptions.map(tokens => (
                        <option key={tokens} value={tokens}>{tokens}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Top-P and Top-K in one row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-gray-400">Top-P</label>
                      <span className="text-xs text-brand-blue font-medium">{config.topP}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.topP}
                      onChange={(e) => updateConfig('topP', parseFloat(e.target.value))}
                      disabled={disabled}
                      className="w-full slider"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-gray-400">Top-K</label>
                      <span className="text-xs text-brand-blue font-medium">{config.topK}</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={config.topK}
                      onChange={(e) => updateConfig('topK', parseInt(e.target.value) || 1)}
                      disabled={disabled}
                      className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* System Instructions Section */}
          <div>
            <div 
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-750 transition-colors border-b border-gray-700"
              onClick={() => setShowSystemInstructions(!showSystemInstructions)}
            >
              <h4 className="text-sm font-medium text-gray-300">System Instructions</h4>
              <div className={`transform transition-transform text-xs text-gray-400 ${showSystemInstructions ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </div>
            
            {showSystemInstructions && (
              <div className="p-4 space-y-3">
                {/* Preset Selection */}
                <select
                  value={activePreset}
                  onChange={(e) => handlePresetChange(e.target.value as keyof typeof systemInstructions)}
                  disabled={disabled}
                  className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
                >
                  <option value="transcriber">📝 Expert Transcriber</option>
                  <option value="transcriptionEditor">✏️ Transcript Editor</option>
                  <option value="jsonFormatter">🔧 JSON Formatter</option>
                  <option value="codeReviewer">👀 Code Reviewer</option>
                  <option value="custom">✨ Custom Instructions</option>
                </select>

                {/* System Instruction Textarea */}
                <textarea
                  value={typeof config.systemInstruction === 'string' ? config.systemInstruction : config.systemInstruction.join('\n')}
                  onChange={(e) => handleSystemInstructionChange(e.target.value)}
                  disabled={disabled}
                  rows={4}
                  className="w-full px-2 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50 font-mono"
                  placeholder="Define AI behavior and output format..."
                />
              </div>
            )}
          </div>

          {/* Advanced Settings Section */}
          <div>
            <div 
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-750 transition-colors"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              <h4 className="text-sm font-medium text-gray-300">Advanced Settings</h4>
              <div className={`transform transition-transform text-xs text-gray-400 ${showAdvancedSettings ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </div>
            
            {showAdvancedSettings && (
              <div className="p-4 space-y-3">
                {/* Response Format */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Response Format</label>
                  <select
                    value={config.responseMimeType || ''}
                    onChange={(e) => updateConfig('responseMimeType', e.target.value || undefined)}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
                  >
                    <option value="">Auto</option>
                    <option value="application/json">JSON</option>
                    <option value="text/plain">Plain Text</option>
                    <option value="text/markdown">Markdown</option>
                  </select>
                </div>

                {/* Stop Sequences */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Stop Sequences</label>
                  <input
                    type="text"
                    value={config.stopSequences?.join(', ') || ''}
                    onChange={(e) => {
                      const sequences = e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                      updateConfig('stopSequences', sequences.length > 0 ? sequences : undefined);
                    }}
                    disabled={disabled}
                    placeholder="END, STOP, ###"
                    className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      <style jsx>{`
        .slider {
          -webkit-appearance: none;
          height: 6px;
          border-radius: 3px;
          background: #374151;
          outline: none;
        }
        
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};