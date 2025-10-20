// Configuration system types for API key management
// Similar to VSCode extensions like Cline, Kilo Code

export interface APIKeyConfig {
  gemini?: string;
  openai?: string;
  lastUpdated?: number;
  isValid?: boolean;
}

export interface ModelConfig {
  // Gemini Configuration
  gemini: {
    model: string;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    systemInstruction?: string;
    responseMimeType?: string;
    stopSequences?: string[];
  };
  
  // OpenAI Configuration
  openai: {
    model: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    modalities: string[];
    audio?: {
      voice: string;
      format: string;
    };
    systemInstruction?: string;
  };
}

export interface AppConfig {
  apiKeys: APIKeyConfig;
  models: ModelConfig;
  ui: {
    theme: 'dark' | 'light';
    debugMode: boolean;
    autoSave: boolean;
  };
  version: string;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  gemini: {
    model: 'gemini-2.5-pro',
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    systemInstruction: 'You are a helpful AI assistant.',
  },
  openai: {
    model: 'gpt-4o-audio-preview',
    temperature: 0.7,
    maxTokens: 4096,
    modalities: ['text'],
    systemInstruction: 'You are a helpful AI assistant.',
  }
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiKeys: {},
  models: DEFAULT_MODEL_CONFIG,
  ui: {
    theme: 'dark',
    debugMode: false,
    autoSave: true,
  },
  version: '1.0.0',
};

// Available models for each provider
export const AVAILABLE_MODELS = {
  gemini: [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Most capable model for complex reasoning and analysis',
      contextWindow: 1000000,
      inputCost: 0.000001,
      outputCost: 0.000002,
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Fast and efficient for everyday tasks',
      contextWindow: 1000000,
      inputCost: 0.0000005,
      outputCost: 0.000001,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Balanced performance and capability',
      contextWindow: 128000,
      inputCost: 0.0000035,
      outputCost: 0.0000105,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fastest responses for simple tasks',
      contextWindow: 128000,
      inputCost: 0.000000075,
      outputCost: 0.0000003,
    },
  ],
  openai: [
    {
      id: 'gpt-4o-audio-preview',
      name: 'GPT-4o Audio Preview',
      description: 'Latest multimodal model with audio input/output',
      contextWindow: 128000,
      audioSupport: true,
      inputCost: 0.0025,
      outputCost: 0.01,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'High-intelligence flagship model',
      contextWindow: 128000,
      audioSupport: false,
      inputCost: 0.0025,
      outputCost: 0.01,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Affordable and intelligent small model',
      contextWindow: 128000,
      audioSupport: false,
      inputCost: 0.00015,
      outputCost: 0.0006,
    },
  ],
};

// Provider information
export const API_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    keyFormat: 'AI...',
    keyValidation: /^AI[a-zA-Z0-9_-]{30,}$/,
    description: 'Google\'s multimodal AI model with advanced reasoning capabilities',
    setupUrl: 'https://aistudio.google.com/app/apikey',
    features: ['Text generation', 'Audio transcription', 'Multimodal input'],
  },
  openai: {
    name: 'OpenAI',
    keyFormat: 'sk-... or sk-proj-...',
    keyValidation: /^sk-(proj-)?[a-zA-Z0-9]{40,}$/,
    description: 'OpenAI\'s GPT models and Whisper for audio processing',
    setupUrl: 'https://platform.openai.com/api-keys',
    features: ['Text generation', 'Audio transcription', 'Audio generation'],
  },
};

export type ProviderType = keyof typeof API_PROVIDERS;