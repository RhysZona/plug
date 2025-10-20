// Debug Panel: Eye-Bleeding Level Debug Information Viewer
// Displays all debug logs with filtering, searching, and download capabilities

import React, { useState, useEffect, useRef } from 'react';
import { debugLogger, LogEntry } from '../services/debugLogger';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type LogLevel = LogEntry['level'] | 'ALL';
type LogComponent = string | 'ALL';

const DebugPanel: React.FC<DebugPanelProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('ALL');
  const [selectedComponent, setSelectedComponent] = useState<LogComponent>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDetails, setShowDetails] = useState<string[]>([]);
  const [maxLogs, setMaxLogs] = useState(100);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  // Get unique components and levels from logs
  const uniqueComponents = [...new Set(logs.map(log => log.component))].sort();
  const uniqueLevels: LogEntry['level'][] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

  // Refresh logs from debugLogger
  const refreshLogs = () => {
    const currentLogs = debugLogger.getLogs();
    setLogs([...currentLogs]);
  };

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && isOpen) {
      refreshIntervalRef.current = setInterval(refreshLogs, 1000); // Refresh every second
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, isOpen]);

  // Initial load and manual refresh
  useEffect(() => {
    if (isOpen) {
      refreshLogs();
    }
  }, [isOpen]);

  // Filter logs based on level, component, and search term
  useEffect(() => {
    let filtered = logs;

    if (selectedLevel !== 'ALL') {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }

    if (selectedComponent !== 'ALL') {
      filtered = filtered.filter(log => log.component === selectedComponent);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        log.method.toLowerCase().includes(term) ||
        log.component.toLowerCase().includes(term) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(term))
      );
    }

    // Limit to maxLogs for performance
    filtered = filtered.slice(-maxLogs);

    setFilteredLogs(filtered);
  }, [logs, selectedLevel, selectedComponent, searchTerm, maxLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoRefresh) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoRefresh]);

  const toggleDetails = (logId: string) => {
    setShowDetails(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  const getLevelColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'TRACE': return 'text-gray-400';
      case 'DEBUG': return 'text-blue-400';
      case 'INFO': return 'text-green-400';
      case 'WARN': return 'text-yellow-400';
      case 'ERROR': return 'text-red-400';
      case 'FATAL': return 'text-red-600';
      default: return 'text-white';
    }
  };

  const getLevelBg = (level: LogEntry['level']): string => {
    switch (level) {
      case 'TRACE': return 'bg-gray-800';
      case 'DEBUG': return 'bg-blue-900';
      case 'INFO': return 'bg-green-900';
      case 'WARN': return 'bg-yellow-900';
      case 'ERROR': return 'bg-red-900';
      case 'FATAL': return 'bg-red-800';
      default: return 'bg-gray-800';
    }
  };

  const getLevelEmoji = (level: LogEntry['level']): string => {
    switch (level) {
      case 'TRACE': return '🔍';
      case 'DEBUG': return '🐛';
      case 'INFO': return 'ℹ️';
      case 'WARN': return '⚠️';
      case 'ERROR': return '❌';
      case 'FATAL': return '💀';
      default: return '📝';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const clearLogs = () => {
    debugLogger.clearLogs();
    setLogs([]);
    setFilteredLogs([]);
    setShowDetails([]);
  };

  const downloadLogs = (format: 'json' | 'markdown') => {
    debugLogger.downloadLogs(format);
  };

  const copyLogToClipboard = (log: LogEntry) => {
    const logText = `[${log.level}] ${log.component}::${log.method} - ${log.message}\\n${JSON.stringify(log.details, null, 2)}`;
    navigator.clipboard.writeText(logText);
  };

  const getLogStats = () => {
    const stats = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogEntry['level'], number>);
    
    return stats;
  };

  const stats = getLogStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="w-full h-full max-w-7xl max-h-screen bg-gray-900 text-white border border-gray-700 rounded-lg flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">🐛 Debug Panel - Eye-Bleeding Detail Level</h2>
            <div className="text-sm text-gray-400">
              {filteredLogs.length} of {logs.length} logs
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                autoRefresh 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {autoRefresh ? '⏸️ Pause' : '▶️ Resume'}
            </button>
            
            <button
              onClick={refreshLogs}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
            >
              🔄 Refresh
            </button>
            
            <button
              onClick={clearLogs}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
            >
              🗑️ Clear
            </button>
            
            <div className="flex space-x-1">
              <button
                onClick={() => downloadLogs('json')}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm transition-colors"
              >
                📄 JSON
              </button>
              <button
                onClick={() => downloadLogs('markdown')}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm transition-colors"
              >
                📝 Markdown
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              ❌ Close
            </button>
          </div>
        </div>

        {/* Statistics Bar */}
        <div className="flex items-center space-x-4 p-3 bg-gray-800 border-b border-gray-700 text-sm">
          <div className="flex space-x-4">
            {uniqueLevels.map(level => (
              <div key={level} className={`flex items-center space-x-1 ${getLevelColor(level)}`}>
                <span>{getLevelEmoji(level)}</span>
                <span>{level}: {stats[level] || 0}</span>
              </div>
            ))}
          </div>
          
          <div className="text-gray-400 ml-auto">
            Memory: {(performance as any).memory ? 
              `${((performance as any).memory.usedJSMemory / 1024 / 1024).toFixed(1)}MB` : 
              'N/A'
            }
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 p-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Level:</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as LogLevel)}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="ALL">All</option>
              {uniqueLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Component:</label>
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value as LogComponent)}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value="ALL">All</option>
              {uniqueComponents.map(component => (
                <option key={component} value={component}>{component}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 flex-1">
            <label className="text-sm text-gray-300">Search:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm flex-1 max-w-xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Max:</label>
            <select
              value={maxLogs}
              onChange={(e) => setMaxLogs(Number(e.target.value))}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>
        </div>

        {/* Logs Container */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No logs match the current filters
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const logId = `${log.timestamp}_${index}`;
              const isExpanded = showDetails.includes(logId);

              return (
                <div 
                  key={logId} 
                  className={`border border-gray-700 rounded-md overflow-hidden ${getLevelBg(log.level)}`}
                >
                  {/* Log Header */}
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700/50"
                    onClick={() => toggleDetails(logId)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <span className="text-lg">{getLevelEmoji(log.level)}</span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${getLevelColor(log.level)} bg-gray-800`}>
                          {log.level}
                        </span>
                        <span className="text-sm font-mono text-gray-400">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.performanceMs && (
                          <span className="text-xs text-purple-400">
                            +{log.performanceMs.toFixed(2)}ms
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-sm font-semibold text-blue-300">
                          {log.component}
                        </span>
                        <span className="text-gray-400">::</span>
                        <span className="text-sm text-yellow-300">
                          {log.method}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLogToClipboard(log);
                        }}
                        className="text-xs text-gray-400 hover:text-white p-1"
                        title="Copy log to clipboard"
                      >
                        📋
                      </button>
                      <span className="text-xs text-gray-400">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {/* Log Message */}
                  <div className="px-3 pb-2">
                    <div className="text-sm text-white">
                      {log.message}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-600 bg-gray-800/50 p-3 space-y-3">
                      
                      {/* Details */}
                      {log.details && (
                        <div>
                          <div className="text-xs font-semibold text-gray-300 mb-1">Details:</div>
                          <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto text-gray-300 font-mono">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Memory Usage */}
                      {log.memoryUsage && (
                        <div>
                          <div className="text-xs font-semibold text-gray-300 mb-1">Memory:</div>
                          <div className="text-xs text-gray-400">
                            Used: {(log.memoryUsage.usedJSMemory / 1024 / 1024).toFixed(2)}MB | 
                            Total: {(log.memoryUsage.totalJSMemory / 1024 / 1024).toFixed(2)}MB | 
                            Limit: {(log.memoryUsage.jsMemoryLimit / 1024 / 1024).toFixed(2)}MB
                          </div>
                        </div>
                      )}

                      {/* Stack Trace */}
                      {log.stackTrace && (
                        <div>
                          <div className="text-xs font-semibold text-gray-300 mb-1">Stack Trace:</div>
                          <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto text-red-300 font-mono">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}

                      {/* Session Info */}
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-600">
                        Session: {log.sessionId} | UA: {log.userAgent?.substring(0, 50)}...
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;