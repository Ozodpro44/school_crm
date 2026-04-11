/**
 * Server Logs Panel Component
 * Displays real-time server logs and deployment info
 */

import React, { useEffect, useState } from 'react';
import { railwayLogsService, type RailwayLog, type RailwayDeployment } from '@/services/railway-logs';
import { apiClient } from '@/services/api-client';

interface ServerInfo {
  status: 'healthy' | 'checking' | 'error';
  uptime?: number;
  lastCheck?: Date;
}

export function ServerLogsPanel() {
  const [logs, setLogs] = useState<RailwayLog[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo>({ status: 'checking' });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDeployment, setShowDeployment] = useState(false);

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const newLogs = await railwayLogsService.getLogs(50);
        setLogs(newLogs);
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };

    fetchLogs();
    setLoading(false);

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Check server health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await apiClient.healthCheck();
        setServerInfo({
          status: health.status === 'healthy' ? 'healthy' : 'error',
          lastCheck: new Date(),
        });
      } catch (error) {
        setServerInfo({
          status: 'error',
          lastCheck: new Date(),
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);

    return () => clearInterval(interval);
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ff3b30';
      case 'warn':
        return '#ff9500';
      case 'debug':
        return '#5ac8fa';
      default:
        return '#34c759';
    }
  };

  return (
    <div className="w-full bg-slate-900 text-slate-100 rounded-lg overflow-hidden border border-slate-700">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Server Logs</h3>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    serverInfo.status === 'healthy' ? '#34c759' : '#ff3b30',
                }}
              />
              <span className="text-sm text-slate-300">
                {serverInfo.status === 'healthy' ? 'Healthy' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-refresh</span>
            </label>

            <button
              onClick={() => setShowDeployment(!showDeployment)}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              {showDeployment ? 'Hide' : 'Show'} Deployment
            </button>
          </div>
        </div>

        {serverInfo.lastCheck && (
          <div className="text-xs text-slate-400 mt-2">
            Last checked: {serverInfo.lastCheck.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="overflow-y-auto max-h-96 bg-slate-950 font-mono text-sm">
        {loading ? (
          <div className="p-4 text-slate-400">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-slate-400">No logs available</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className="px-4 py-2 border-b border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: getLevelColor(log.level) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className="text-xs font-semibold flex-shrink-0"
                      style={{ color: getLevelColor(log.level) }}
                    >
                      {log.level.toUpperCase()}
                    </span>
                    {log.service && (
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        [{log.service}]
                      </span>
                    )}
                  </div>
                  <div className="text-slate-200 break-words text-xs mt-1">
                    {log.message}
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="text-slate-500 text-xs mt-1 ml-2">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Deployment Info */}
      {showDeployment && (
        <div className="bg-slate-800 px-4 py-3 border-t border-slate-700">
          <DeploymentInfo />
        </div>
      )}

      {/* Footer */}
      <div className="bg-slate-800 px-4 py-2 border-t border-slate-700 text-xs text-slate-400 flex justify-between">
        <span>Total logs: {logs.length}</span>
        <button
          onClick={() => railwayLogsService.clearCache()}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear cache
        </button>
      </div>
    </div>
  );
}

/**
 * Deployment Info Sub-component
 */
function DeploymentInfo() {
  const [deployment, setDeployment] = useState<RailwayDeployment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        const dep = await railwayLogsService.getDeployment();
        setDeployment(dep);
      } catch (error) {
        console.error('Failed to fetch deployment info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeployment();
  }, []);

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading deployment info...</div>;
  }

  if (!deployment) {
    return (
      <div className="text-slate-400 text-sm">
        No deployment info available (Railway not configured)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-slate-300">Deployment Info</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Status: </span>
          <span
            className="font-semibold"
            style={{
              color: deployment.status === 'UP' ? '#34c759' : '#ff3b30',
            }}
          >
            {deployment.status}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Created: </span>
          <span className="text-slate-300">
            {new Date(deployment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Updated: </span>
          <span className="text-slate-300">
            {new Date(deployment.updatedAt).toLocaleTimeString()}
          </span>
        </div>
        <div>
          <span className="text-slate-500">ID: </span>
          <span className="text-slate-400 text-xs font-mono">
            {deployment.id?.substring(0, 8)}...
          </span>
        </div>
      </div>
    </div>
  );
}

export default ServerLogsPanel;
