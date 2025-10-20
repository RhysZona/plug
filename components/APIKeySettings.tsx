import React, { useState, useEffect } from 'react';
import { configManager } from '../services/configManager';
import {
  ProviderType,
  API_PROVIDERS,
  AVAILABLE_MODELS,
  APIKeyConfig,
} from '../types/config';

interface APIKeySettingsProps {
  onClose: () => void;
}

interface ProviderState {
  apiKey: string;
  isValid: boolean;
  isValidating: boolean;
  error: string;
  isVisible: boolean;
}

const APIKeySettings: React.FC<APIKeySettingsProps> = ({ onClose }) => {
  const [providers, setProviders] = useState<Record<ProviderType, ProviderState>>({
    gemini: { apiKey: '', isValid: false, isValidating: false, error: '', isVisible: false },
    openai: { apiKey: '', isValid: false, isValidating: false, error: '', isVisible: false },
  });
  const [activeTab, setActiveTab] = useState<ProviderType>('gemini');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load existing API keys
    const apiKeys = configManager.getAPIKeys();
    setProviders(prev => {
      const updated = { ...prev };
      Object.keys(API_PROVIDERS).forEach(provider => {
        const providerKey = provider as ProviderType;
        const existingKey = apiKeys[providerKey];
        if (existingKey) {
          updated[providerKey] = {
            ...updated[providerKey],
            apiKey: existingKey,
            isValid: configManager.validateAPIKey(providerKey, existingKey),
          };
        }
      });
      return updated;
    });
  }, []);

  const handleAPIKeyChange = (provider: ProviderType, value: string) => {
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        apiKey: value,
        isValid: configManager.validateAPIKey(provider, value),
        error: '',
      },
    }));
    setHasChanges(true);
  };

  const toggleVisibility = (provider: ProviderType) => {
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        isVisible: !prev[provider].isVisible,
      },
    }));
  };

  const validateAPIKey = async (provider: ProviderType) => {
    const providerState = providers[provider];
    if (!providerState.apiKey) return;

    setProviders(prev => ({
      ...prev,
      [provider]: { ...prev[provider], isValidating: true, error: '' },
    }));

    try {
      // Basic format validation
      const isValidFormat = configManager.validateAPIKey(provider, providerState.apiKey);
      
      if (!isValidFormat) {
        throw new Error(`Invalid format. Expected: ${API_PROVIDERS[provider].keyFormat}`);
      }

      // TODO: Add actual API validation by making a test request
      // For now, just validate format
      setProviders(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          isValid: true,
          isValidating: false,
          error: '',
        },
      }));
    } catch (error) {
      setProviders(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          isValid: false,
          isValidating: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        },
      }));
    }
  };

  const saveAPIKey = async (provider: ProviderType) => {
    const providerState = providers[provider];
    
    try {
      if (providerState.apiKey) {
        configManager.setAPIKey(provider, providerState.apiKey);
      } else {
        configManager.removeAPIKey(provider);
      }
      setHasChanges(false);
    } catch (error) {
      setProviders(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          error: error instanceof Error ? error.message : 'Failed to save API key',
        },
      }));
    }
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      for (const [providerKey, state] of Object.entries(providers)) {
        const provider = providerKey as ProviderType;
        const typedState = state as ProviderState;
        if (typedState.apiKey && typedState.isValid) {
          configManager.setAPIKey(provider, typedState.apiKey);
        } else if (!typedState.apiKey) {
          configManager.removeAPIKey(provider);
        }
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save API keys:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const clearAPIKey = (provider: ProviderType) => {
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        apiKey: '',
        isValid: false,
        error: '',
      },
    }));
    configManager.removeAPIKey(provider);
    setHasChanges(true);
  };

  const renderProviderTab = (provider: ProviderType) => {
    const providerInfo = API_PROVIDERS[provider];
    const state = providers[provider];
    const hasKey = configManager.hasAPIKey(provider);
    
    return (
      <div
        key={provider}
        onClick={() => setActiveTab(provider)}
        className={`cursor-pointer px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
          activeTab === provider
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      >
        <div className={`w-2 h-2 rounded-full ${
          hasKey && state.isValid ? 'bg-green-400' : 
          hasKey ? 'bg-yellow-400' : 'bg-gray-500'
        }`} />
        <span className="font-medium">{providerInfo.name}</span>
      </div>
    );
  };

  const renderProviderPanel = (provider: ProviderType) => {
    const providerInfo = API_PROVIDERS[provider];
    const state = providers[provider];
    const availableModels = AVAILABLE_MODELS[provider];
    
    return (
      <div className="space-y-6">
        {/* Provider Info */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-2">{providerInfo.name}</h3>
          <p className="text-gray-300 text-sm mb-3">{providerInfo.description}</p>
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400">Features:</h4>
            <div className="flex flex-wrap gap-2">
              {providerInfo.features.map((feature, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mt-4">
            <a
              href={providerInfo.setupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Get API Key →
            </a>
          </div>
        </div>

        {/* API Key Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-300">API Key</h4>
            <div className="flex items-center space-x-2">
              {state.isValid && (
                <span className="text-xs text-green-400 flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Valid
                </span>
              )}
            </div>
          </div>
          
          <div className="relative">
            <input
              type={state.isVisible ? 'text' : 'password'}
              value={state.apiKey}
              onChange={(e) => handleAPIKeyChange(provider, e.target.value)}
              placeholder={`Enter your ${providerInfo.name} API key (${providerInfo.keyFormat})`}
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 pr-20 font-mono text-sm ${
                state.error
                  ? 'border-red-500 focus:ring-red-500'
                  : state.isValid
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-600 focus:ring-blue-500'
              }`}
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => toggleVisibility(provider)}
                className="p-1 text-gray-400 hover:text-gray-300 rounded"
                title={state.isVisible ? 'Hide API key' : 'Show API key'}
              >
                {state.isVisible ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                )}
              </button>
              
              {state.apiKey && (
                <button
                  type="button"
                  onClick={() => clearAPIKey(provider)}
                  className="p-1 text-gray-400 hover:text-red-400 rounded"
                  title="Clear API key"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {state.error && (
            <div className="text-red-400 text-xs bg-red-900/20 p-2 rounded">
              {state.error}
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => validateAPIKey(provider)}
              disabled={!state.apiKey || state.isValidating}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
            >
              {state.isValidating ? 'Validating...' : 'Validate'}
            </button>
            
            <button
              onClick={() => saveAPIKey(provider)}
              disabled={!state.apiKey || !state.isValid}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {/* Available Models */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300">Available Models</h4>
          <div className="grid gap-2">
            {availableModels.map((model) => (
              <div
                key={model.id}
                className="bg-gray-700/30 rounded p-3 border border-gray-600/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-white text-sm">{model.name}</h5>
                    <p className="text-xs text-gray-400 mt-1">{model.description}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>{model.contextWindow.toLocaleString()} tokens</div>
                    {'audioSupport' in model && model.audioSupport && (
                      <div className="text-blue-400">Audio</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">API Key Configuration</h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure your AI provider API keys for transcription and editing
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-[600px]">
          {/* Provider Tabs */}
          <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
            <div className="space-y-2">
              {Object.keys(API_PROVIDERS).map(provider =>
                renderProviderTab(provider as ProviderType)
              )}
            </div>
            
            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-gray-700 space-y-2">
              <button
                onClick={saveAllChanges}
                disabled={!hasChanges || isSaving}
                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors text-sm"
              >
                {isSaving ? 'Saving...' : 'Save All Changes'}
              </button>
              
              <button
                onClick={() => configManager.clearAll()}
                className="w-full px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors text-sm border border-red-600/30"
              >
                Clear All Data
              </button>
            </div>
          </div>

          {/* Provider Panel */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {renderProviderPanel(activeTab)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeySettings;