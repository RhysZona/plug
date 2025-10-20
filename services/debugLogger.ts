// Ultra-Detailed Debug Logger - Eye-Bleeding Level Debugging System
// Every single operation will be logged with excruciating detail

export interface LogEntry {
  timestamp: string;
  level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  component: string;
  method: string;
  message: string;
  details?: any;
  stackTrace?: string;
  performanceMs?: number;
  memoryUsage?: any;
  networkInfo?: any;
  userAgent?: string;
  sessionId: string;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private sessionId: string;
  private startTime: number;
  private performanceMarkers: Map<string, number> = new Map();

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = performance.now();
    
    // Log browser environment with excessive detail
    this.logEnvironmentInfo();
    
    // Set up global error capture
    this.setupGlobalErrorCapture();
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
  }

  private generateSessionId(): string {
    return `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logEnvironmentInfo() {
    const envInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      memoryInfo: (performance as any).memory || 'Not available',
      timing: performance.timing,
      location: {
        href: window.location.href,
        protocol: window.location.protocol,
        host: window.location.host,
        port: window.location.port,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      },
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      }
    };

    this.log('INFO', 'DebugLogger', 'constructor', 'Environment initialized', envInfo);
  }

  private setupGlobalErrorCapture() {
    // Capture all JavaScript errors
    window.addEventListener('error', (event) => {
      this.log('ERROR', 'GlobalErrorHandler', 'windowError', 'Uncaught JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack,
        timestamp: event.timeStamp
      });
    });

    // Capture all Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log('ERROR', 'GlobalErrorHandler', 'unhandledRejection', 'Unhandled Promise rejection', {
        reason: event.reason,
        promise: event.promise,
        stack: event.reason?.stack,
        timestamp: event.timeStamp
      });
    });

    // Capture all resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.log('ERROR', 'ResourceLoader', 'resourceError', 'Resource failed to load', {
          tagName: (event.target as any)?.tagName,
          src: (event.target as any)?.src || (event.target as any)?.href,
          type: (event.target as any)?.type,
          currentSrc: (event.target as any)?.currentSrc,
          timestamp: event.timeStamp
        });
      }
    }, true);
  }

  private setupPerformanceMonitoring() {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.log('WARN', 'PerformanceMonitor', 'longTask', 'Long task detected', {
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              type: entry.entryType
            });
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        this.log('DEBUG', 'PerformanceMonitor', 'setup', 'Long task monitoring not supported', { error: e });
      }
    }
  }

  public startPerformanceTimer(label: string): void {
    const timestamp = performance.now();
    this.performanceMarkers.set(label, timestamp);
    this.log('TRACE', 'PerformanceTimer', 'start', `Performance timer started: ${label}`, {
      startTime: timestamp,
      label
    });
  }

  public endPerformanceTimer(label: string): number {
    const endTime = performance.now();
    const startTime = this.performanceMarkers.get(label);
    
    if (startTime) {
      const duration = endTime - startTime;
      this.performanceMarkers.delete(label);
      
      this.log('TRACE', 'PerformanceTimer', 'end', `Performance timer ended: ${label}`, {
        startTime,
        endTime,
        duration,
        label
      });
      
      return duration;
    } else {
      this.log('WARN', 'PerformanceTimer', 'end', `Performance timer not found: ${label}`, {
        endTime,
        label
      });
      return 0;
    }
  }

  public log(
    level: LogEntry['level'],
    component: string,
    method: string,
    message: string,
    details?: any,
    includeStack: boolean = false
  ): void {
    const timestamp = new Date().toISOString();
    const sessionTime = performance.now() - this.startTime;
    
    const entry: LogEntry = {
      timestamp,
      level,
      component,
      method,
      message,
      details: details ? JSON.parse(JSON.stringify(details, this.jsonReplacer)) : undefined,
      stackTrace: includeStack ? new Error().stack : undefined,
      performanceMs: sessionTime,
      memoryUsage: (performance as any).memory ? {
        usedJSMemory: (performance as any).memory.usedJSMemory,
        totalJSMemory: (performance as any).memory.totalJSMemory,
        jsMemoryLimit: (performance as any).memory.jsMemoryLimit
      } : undefined,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId
    };

    this.logs.push(entry);
    
    // Console output with colors and formatting
    const consoleMethod = this.getConsoleMethod(level);
    const color = this.getLevelColor(level);
    const emoji = this.getLevelEmoji(level);
    
    console.group(`${emoji} [${level}] ${component}::${method}`);
    console.log(`%c${timestamp} (+${sessionTime.toFixed(2)}ms)`, `color: ${color}; font-weight: bold;`);
    console.log(`%c${message}`, `color: ${color};`);
    
    if (details) {
      console.log('%cDetails:', 'color: #888; font-weight: bold;');
      console.log(details);
    }
    
    if (includeStack && entry.stackTrace) {
      console.log('%cStack Trace:', 'color: #888; font-weight: bold;');
      console.log(entry.stackTrace);
    }
    
    if (entry.memoryUsage) {
      console.log('%cMemory Usage:', 'color: #888; font-weight: bold;');
      console.log(`Used: ${(entry.memoryUsage.usedJSMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Total: ${(entry.memoryUsage.totalJSMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Limit: ${(entry.memoryUsage.jsMemoryLimit / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.groupEnd();

    // Keep only last 1000 logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  private jsonReplacer(key: string, value: any): any {
    // Handle circular references and special objects
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }
    
    if (value instanceof File) {
      return {
        name: value.name,
        size: value.size,
        type: value.type,
        lastModified: value.lastModified
      };
    }
    
    if (value instanceof FormData) {
      const entries: any = {};
      for (const [key, val] of value.entries()) {
        entries[key] = val instanceof File ? {
          name: val.name,
          size: val.size,
          type: val.type
        } : val;
      }
      return entries;
    }
    
    if (value instanceof Headers) {
      const headers: any = {};
      value.forEach((val, key) => {
        headers[key] = val;
      });
      return headers;
    }
    
    return value;
  }

  private getConsoleMethod(level: LogEntry['level']) {
    switch (level) {
      case 'TRACE': return console.debug;
      case 'DEBUG': return console.debug;
      case 'INFO': return console.info;
      case 'WARN': return console.warn;
      case 'ERROR': return console.error;
      case 'FATAL': return console.error;
      default: return console.log;
    }
  }

  private getLevelColor(level: LogEntry['level']): string {
    switch (level) {
      case 'TRACE': return '#888';
      case 'DEBUG': return '#007acc';
      case 'INFO': return '#00aa00';
      case 'WARN': return '#ff8800';
      case 'ERROR': return '#ff0000';
      case 'FATAL': return '#8b0000';
      default: return '#000000';
    }
  }

  private getLevelEmoji(level: LogEntry['level']): string {
    switch (level) {
      case 'TRACE': return '🔍';
      case 'DEBUG': return '🐛';
      case 'INFO': return 'ℹ️';
      case 'WARN': return '⚠️';
      case 'ERROR': return '❌';
      case 'FATAL': return '💀';
      default: return '📝';
    }
  }

  // Network request logging with extreme detail
  public logNetworkRequest(
    url: string,
    method: string,
    headers?: HeadersInit,
    body?: any,
    requestId?: string
  ): string {
    const id = requestId || `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    this.log('INFO', 'NetworkLogger', 'request', `HTTP ${method} ${url}`, {
      requestId: id,
      method,
      url,
      headers,
      body,
      timestamp: Date.now(),
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      downlink: (navigator as any).connection?.downlink || 'unknown',
      rtt: (navigator as any).connection?.rtt || 'unknown'
    });
    
    return id;
  }

  public logNetworkResponse(
    requestId: string,
    response: Response,
    responseData?: any,
    error?: Error
  ): void {
    this.log(error ? 'ERROR' : 'INFO', 'NetworkLogger', 'response', 
      `HTTP Response ${response?.status || 'ERROR'} for ${requestId}`, {
      requestId,
      status: response?.status,
      statusText: response?.statusText,
      headers: response ? this.responseHeadersToObject(response.headers) : undefined,
      responseData,
      error,
      ok: response?.ok,
      redirected: response?.redirected,
      type: response?.type,
      url: response?.url
    });
  }

  private responseHeadersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  // File operations logging
  public logFileOperation(
    operation: string,
    file: File | null,
    component: string,
    details?: any
  ): void {
    this.log('DEBUG', component, 'fileOperation', `File operation: ${operation}`, {
      operation,
      file: file ? {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        lastModifiedDate: new Date(file.lastModified).toISOString()
      } : null,
      details
    });
  }

  // Component lifecycle logging
  public logComponentLifecycle(
    component: string,
    lifecycle: 'mount' | 'unmount' | 'update' | 'error',
    details?: any
  ): void {
    this.log('DEBUG', component, 'lifecycle', `Component ${lifecycle}`, {
      lifecycle,
      details,
      componentStack: new Error().stack
    });
  }

  // State change logging
  public logStateChange(
    component: string,
    stateName: string,
    oldValue: any,
    newValue: any,
    details?: any
  ): void {
    this.log('DEBUG', component, 'stateChange', `State changed: ${stateName}`, {
      stateName,
      oldValue,
      newValue,
      details,
      changeStack: new Error().stack
    });
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.log('INFO', 'DebugLogger', 'clearLogs', 'Clearing all logs');
    this.logs = [];
  }

  public exportLogs(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      totalLogs: this.logs.length,
      sessionDuration: performance.now() - this.startTime,
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      logs: this.logs
    };

    return JSON.stringify(exportData, null, 2);
  }

  public exportLogsAsMarkdown(): string {
    const exportTime = new Date().toISOString();
    const sessionDuration = ((performance.now() - this.startTime) / 1000).toFixed(2);
    
    let markdown = `# Debug Log Export\n\n`;
    markdown += `**Session ID:** ${this.sessionId}\n`;
    markdown += `**Export Time:** ${exportTime}\n`;
    markdown += `**Session Duration:** ${sessionDuration}s\n`;
    markdown += `**Total Logs:** ${this.logs.length}\n`;
    markdown += `**User Agent:** ${navigator.userAgent}\n`;
    markdown += `**URL:** ${window.location.href}\n\n`;

    markdown += `## Environment Information\n\n`;
    markdown += `- **Platform:** ${navigator.platform}\n`;
    markdown += `- **Language:** ${navigator.language}\n`;
    markdown += `- **Online:** ${navigator.onLine}\n`;
    markdown += `- **Cookie Enabled:** ${navigator.cookieEnabled}\n`;
    markdown += `- **Screen:** ${screen.width}x${screen.height}\n`;
    markdown += `- **Viewport:** ${window.innerWidth}x${window.innerHeight}\n`;
    markdown += `- **Device Pixel Ratio:** ${window.devicePixelRatio}\n\n`;

    markdown += `## Logs\n\n`;

    this.logs.forEach((entry, index) => {
      markdown += `### ${index + 1}. ${entry.level} - ${entry.component}::${entry.method}\n\n`;
      markdown += `- **Time:** ${entry.timestamp} (+${entry.performanceMs?.toFixed(2)}ms)\n`;
      markdown += `- **Message:** ${entry.message}\n`;
      
      if (entry.details) {
        markdown += `- **Details:**\n\`\`\`json\n${JSON.stringify(entry.details, null, 2)}\n\`\`\`\n`;
      }
      
      if (entry.memoryUsage) {
        markdown += `- **Memory:** ${(entry.memoryUsage.usedJSMemory / 1024 / 1024).toFixed(2)}MB used\n`;
      }
      
      if (entry.stackTrace) {
        markdown += `- **Stack Trace:**\n\`\`\`\n${entry.stackTrace}\n\`\`\`\n`;
      }
      
      markdown += `\n---\n\n`;
    });

    return markdown;
  }

  public downloadLogs(format: 'json' | 'markdown' = 'json'): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug-logs-${timestamp}.${format === 'json' ? 'json' : 'md'}`;
    
    const content = format === 'json' ? this.exportLogs() : this.exportLogsAsMarkdown();
    
    const blob = new Blob([content], { 
      type: format === 'json' ? 'application/json' : 'text/markdown' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.log('INFO', 'DebugLogger', 'downloadLogs', `Logs downloaded as ${filename}`, {
      filename,
      format,
      logCount: this.logs.length,
      fileSize: content.length
    });
  }
}

// Global logger instance
export const debugLogger = new DebugLogger();

// Convenience functions
export const trace = (component: string, method: string, message: string, details?: any) => 
  debugLogger.log('TRACE', component, method, message, details);
  
export const debug = (component: string, method: string, message: string, details?: any) => 
  debugLogger.log('DEBUG', component, method, message, details);
  
export const info = (component: string, method: string, message: string, details?: any) => 
  debugLogger.log('INFO', component, method, message, details);
  
export const warn = (component: string, method: string, message: string, details?: any) => 
  debugLogger.log('WARN', component, method, message, details);
  
export const error = (component: string, method: string, message: string, details?: any) => 
  debugLogger.log('ERROR', component, method, message, details, true);
  
export const fatal = (component: string, method: string, message: string, details?: any) => 
  debugLogger.log('FATAL', component, method, message, details, true);

export const startTimer = (label: string) => debugLogger.startPerformanceTimer(label);
export const endTimer = (label: string) => debugLogger.endPerformanceTimer(label);

export const logFile = (operation: string, file: File | null, component: string, details?: any) =>
  debugLogger.logFileOperation(operation, file, component, details);

export const logComponent = (component: string, lifecycle: 'mount' | 'unmount' | 'update' | 'error', details?: any) =>
  debugLogger.logComponentLifecycle(component, lifecycle, details);

export const logState = (component: string, stateName: string, oldValue: any, newValue: any, details?: any) =>
  debugLogger.logStateChange(component, stateName, oldValue, newValue, details);

export const logNetwork = (url: string, method: string, headers?: HeadersInit, body?: any, requestId?: string) =>
  debugLogger.logNetworkRequest(url, method, headers, body, requestId);

export const logNetworkResponse = (requestId: string, response: Response, responseData?: any, error?: Error) =>
  debugLogger.logNetworkResponse(requestId, response, responseData, error);