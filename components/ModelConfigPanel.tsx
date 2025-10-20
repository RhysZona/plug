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
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="text-lg">⚙️</div>
          <div>
            <h3 className="text-lg font-medium text-gray-200">Model Configuration</h3>
            <p className="text-sm text-gray-400">
              {config.model} • Temp: {config.temperature} • Tokens: {config.maxOutputTokens}
            </p>
          </div>
        </div>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-gray-700 space-y-6">
          
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Model
            </label>
            <select
              value={config.model}
              onChange={(e) => updateConfig('model', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
            >
              {availableModels.map(model => (
                <option key={model.value} value={model.value}>
                  {model.label} - {model.description}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-300">
                Temperature
              </label>
              <span className="text-sm text-brand-blue font-medium">
                {config.temperature}
              </span>
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
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Conservative (0)</span>
              <span>Creative (2)</span>
            </div>
          </div>

          {/* Top-P */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-300">
                Top-P (Nucleus Sampling)
              </label>
              <span className="text-sm text-brand-blue font-medium">
                {config.topP}
              </span>
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
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Focused (0)</span>
              <span>Diverse (1)</span>
            </div>
          </div>

          {/* Top-K */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-300">
                Top-K
              </label>
              <span className="text-sm text-brand-blue font-medium">
                {config.topK}
              </span>
            </div>
            <input
              type="number"
              min="1"
              max="40"
              value={config.topK}
              onChange={(e) => updateConfig('topK', parseInt(e.target.value) || 1)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of candidate tokens to consider (1-40)
            </p>
          </div>

          {/* Max Output Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Output Tokens
            </label>
            <div className="grid grid-cols-2 gap-2">
              {tokenOptions.map(tokens => (
                <button
                  key={tokens}
                  onClick={() => updateConfig('maxOutputTokens', tokens)}
                  disabled={disabled}
                  className={`
                    px-3 py-2 rounded text-sm font-medium transition-colors
                    ${config.maxOutputTokens === tokens
                      ? 'bg-brand-blue text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {tokens}
                </button>
              ))}
            </div>
          </div>

          {/* System Instruction Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              System Instruction Preset
            </label>
            <select
              value={activePreset}
              onChange={(e) => handlePresetChange(e.target.value as keyof typeof systemInstructions)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50 mb-3"
            >
              <option value="transcriber">📝 Expert Transcriber</option>
              <option value="transcriptionEditor">✏️ Transcript Editor (Diff Format)</option>
              <option value="jsonFormatter">🔧 JSON Formatter</option>
              <option value="codeReviewer">👀 Code Reviewer</option>
              <option value="custom">✨ Custom Instructions</option>
            </select>

            {/* System Instruction Textarea */}
            <textarea
              value={typeof config.systemInstruction === 'string' ? config.systemInstruction : config.systemInstruction.join('\n')}
              onChange={(e) => handleSystemInstructionChange(e.target.value)}
              disabled={disabled}
              rows={6}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50 font-mono text-sm"
              placeholder="Enter your custom system instructions here..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Define the AI's behavior, role, and output format
            </p>
          </div>

          {/* Advanced Settings */}
          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Advanced Settings</h4>
            
            {/* Response MIME Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Response Format
              </label>
              <select
                value={config.responseMimeType || ''}
                onChange={(e) => updateConfig('responseMimeType', e.target.value || undefined)}
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
              >
                <option value="">Auto (Default)</option>
                <option value="application/json">JSON</option>
                <option value="text/plain">Plain Text</option>
                <option value="text/markdown">Markdown</option>
              </select>
            </div>

            {/* Stop Sequences */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stop Sequences (comma-separated)
              </label>
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
                placeholder="e.g., END, STOP, ###"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-brand-blue disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Stop generation when these strings are encountered
              </p>
            </div>
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