/**
 * Configuration Manager Service
 * Manages API keys and model configurations in localStorage
 * Similar to VSCode extensions like Cline, Kilo Code
 */

import { 
  AppConfig, 
  APIKeyConfig, 
  ModelConfig, 
  DEFAULT_APP_CONFIG, 
  API_PROVIDERS,
  ProviderType 
} from '../types/config';

const CONFIG_STORAGE_KEY = 'plug_app_config';
const CONFIG_VERSION = '1.0.0';

class ConfigManager {
  private config: AppConfig;
  private listeners: ((config: AppConfig) => void)[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.migrateIfNeeded();
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): AppConfig {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!stored) {
        return { ...DEFAULT_APP_CONFIG };
      }

      const parsed = JSON.parse(stored) as AppConfig;
      
      // Merge with defaults to ensure all fields exist
      const merged: AppConfig = {
        ...DEFAULT_APP_CONFIG,
        ...parsed,
        apiKeys: { ...DEFAULT_APP_CONFIG.apiKeys, ...parsed.apiKeys },
        models: {
          gemini: { ...DEFAULT_APP_CONFIG.models.gemini, ...parsed.models?.gemini },
          openai: { ...DEFAULT_APP_CONFIG.models.openai, ...parsed.models?.openai },
        },
        ui: { ...DEFAULT_APP_CONFIG.ui, ...parsed.ui },
      };

      return merged;
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error);
      return { ...DEFAULT_APP_CONFIG };
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      this.config.version = CONFIG_VERSION;
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
      throw new Error('Failed to save configuration');
    }
  }

  /**
   * Migrate configuration if version has changed
   */
  private migrateIfNeeded(): void {
    if (this.config.version !== CONFIG_VERSION) {
      console.log(`Migrating config from v${this.config.version} to v${CONFIG_VERSION}`);
      // Add migration logic here if needed
      this.config.version = CONFIG_VERSION;
      this.saveConfig();
    }
  }

  /**
   * Add configuration change listener
   */
  addListener(listener: (config: AppConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of config changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Config listener error:', error);
      }
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get API keys
   */
  getAPIKeys(): APIKeyConfig {
    return { ...this.config.apiKeys };
  }

  /**
   * Get specific API key
   */
  getAPIKey(provider: ProviderType): string | undefined {
    return this.config.apiKeys[provider];
  }

  /**
   * Set API key for a provider
   */
  setAPIKey(provider: ProviderType, apiKey: string): void {
    // NO VALIDATION - let the API requests validate themselves
    this.config.apiKeys[provider] = apiKey;
    this.config.apiKeys.lastUpdated = Date.now();
    this.saveConfig();
  }

  /**
   * Remove API key for a provider
   */
  removeAPIKey(provider: ProviderType): void {
    delete this.config.apiKeys[provider];
    this.config.apiKeys.lastUpdated = Date.now();
    this.saveConfig();
  }

  /**
   * Validate API key format - ALWAYS RETURNS TRUE (no validation)
   */
  validateAPIKey(provider: ProviderType, apiKey: string): boolean {
    // NO VALIDATION - always return true
    return true;
  }

  /**
   * Check if API key exists for provider
   */
  hasAPIKey(provider: ProviderType): boolean {
    return !!this.config.apiKeys[provider];
  }

  /**
   * Get model configuration for a provider
   */
  getModelConfig(provider: ProviderType): ModelConfig[typeof provider] {
    return { ...this.config.models[provider] };
  }

  /**
   * Update model configuration for a provider
   */
  updateModelConfig<T extends ProviderType>(
    provider: T, 
    config: Partial<ModelConfig[T]>
  ): void {
    if (provider === 'gemini') {
      this.config.models.gemini = {
        ...this.config.models.gemini,
        ...config,
      } as ModelConfig['gemini'];
    } else if (provider === 'openai') {
      this.config.models.openai = {
        ...this.config.models.openai,
        ...config,
      } as ModelConfig['openai'];
    }
    this.saveConfig();
  }

  /**
   * Reset model configuration to defaults
   */
  resetModelConfig(provider: ProviderType): void {
    if (provider === 'gemini') {
      this.config.models.gemini = { ...DEFAULT_APP_CONFIG.models.gemini };
    } else if (provider === 'openai') {
      this.config.models.openai = { ...DEFAULT_APP_CONFIG.models.openai };
    }
    this.saveConfig();
  }

  /**
   * Get UI configuration
   */
  getUIConfig() {
    return { ...this.config.ui };
  }

  /**
   * Update UI configuration
   */
  updateUIConfig(config: Partial<typeof this.config.ui>): void {
    this.config.ui = { ...this.config.ui, ...config };
    this.saveConfig();
  }

  /**
   * Export configuration (excluding API keys for security)
   */
  exportConfig(includeAPIKeys = false): Partial<AppConfig> {
    const exported: Partial<AppConfig> = {
      models: this.config.models,
      ui: this.config.ui,
      version: this.config.version,
    };

    if (includeAPIKeys) {
      // Only include masked keys for security
      exported.apiKeys = Object.fromEntries(
        Object.entries(this.config.apiKeys).map(([key, value]) => {
          if (key === 'lastUpdated' || key === 'isValid') {
            return [key, value];
          }
          if (typeof value === 'string' && value.length > 8) {
            return [key, value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4)];
          }
          return [key, value];
        })
      );
    }

    return exported;
  }

  /**
   * Import configuration (merge with existing)
   */
  importConfig(importedConfig: Partial<AppConfig>, overwrite = false): void {
    if (overwrite) {
      this.config = {
        ...DEFAULT_APP_CONFIG,
        ...importedConfig,
        // Don't import API keys from external configs for security
        apiKeys: this.config.apiKeys,
      };
    } else {
      // Merge configurations
      if (importedConfig.models) {
        this.config.models = {
          gemini: { ...this.config.models.gemini, ...importedConfig.models.gemini },
          openai: { ...this.config.models.openai, ...importedConfig.models.openai },
        };
      }
      if (importedConfig.ui) {
        this.config.ui = { ...this.config.ui, ...importedConfig.ui };
      }
    }
    
    this.saveConfig();
  }

  /**
   * Reset all configuration to defaults
   */
  resetConfig(preserveAPIKeys = true): void {
    const apiKeys = preserveAPIKeys ? this.config.apiKeys : {};
    this.config = {
      ...DEFAULT_APP_CONFIG,
      apiKeys,
    };
    this.saveConfig();
  }

  /**
   * Get configuration for API requests (includes headers)
   */
  getRequestConfig(provider: ProviderType): { apiKey?: string; headers: Record<string, string> } {
    const apiKey = this.getAPIKey(provider);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
      headers[`X-${provider.toUpperCase()}-API-Key`] = apiKey;
    }

    return { apiKey, headers };
  }

  /**
   * Clear all stored data
   */
  clearAll(): void {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    this.config = { ...DEFAULT_APP_CONFIG };
    this.notifyListeners();
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; available: number; quota: number } {
    try {
      const configString = JSON.stringify(this.config);
      const used = new Blob([configString]).size;
      
      // Estimate available localStorage space (usually 5-10MB)
      const quota = 5 * 1024 * 1024; // 5MB estimate
      const available = quota - used;
      
      return { used, available, quota };
    } catch (error) {
      return { used: 0, available: 0, quota: 0 };
    }
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
export default configManager;