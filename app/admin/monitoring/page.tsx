/**
 * Admin Monitoring Dashboard
 *
 * Comprehensive monitoring dashboard for system administrators showing
 * health status, metrics, alerts, and performance data.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle,
  Activity,
  Server,
  Clock,
  FileText,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  HardDrive,
  Cpu,
  MemoryStick
} from 'lucide-react';

interface DashboardData {
  timestamp: string;
  timeframe: string;
  data: {
    processingStats: {
      totalFiles: number;
      successRate: number;
      avgProcessingTime: number;
      filesProcessedToday: number;
      queueDepth: number;
    };
    systemHealth: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      uptime: number;
      memoryUsage: number;
      cpuUsage: number;
      diskUsage: number;
    };
    fileTypeDistribution: Array<{
      fileType: string;
      count: number;
      totalSize: number;
      avgProcessingTime: number;
      successRate: number;
    }>;
    recentErrors: Array<{
      errorType: string;
      count: number;
      lastOccurrence: Date;
      avgRecoveryTime: number;
      affectedFiles: number;
    }>;
    activeAlerts: Array<{
      id: string;
      rule: {
        name: string;
        severity: 'critical' | 'warning' | 'info';
      };
      triggeredAt: Date;
      message: string;
    }>;
  };
  detailed?: {
    healthChecks: Record<string, {
      status: string;
      message: string;
      timestamp: Date;
    }>;
    alertStats: {
      totalRules: number;
      enabledRules: number;
      activeAlerts: number;
    };
  };
}

export default function AdminMonitoringPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/monitoring/dashboard?timeframe=${timeframe}&detailed=true`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  const refreshHealthChecks = useCallback(async () => {
    try {
      await fetch('/api/monitoring/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_health' })
      });

      // Refresh dashboard data after health check refresh
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to refresh health checks:', err);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, timeframe]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData, timeframe]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'unhealthy': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading monitoring dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDashboardData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-gray-600">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50' : ''}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto Refresh {autoRefresh ? 'On' : 'Off'}
          </Button>

          <Button onClick={fetchDashboardData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Button onClick={refreshHealthChecks} variant="outline">
            <Server className="h-4 w-4 mr-2" />
            Run Health Checks
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {getStatusIcon(data.data.systemHealth.status)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(data.data.systemHealth.status)}`}>
              {data.data.systemHealth.status.charAt(0).toUpperCase() + data.data.systemHealth.status.slice(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Uptime: {formatUptime(data.data.systemHealth.uptime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files Processed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.data.processingStats.totalFiles}</div>
            <p className="text-xs text-muted-foreground">
              {data.data.processingStats.filesProcessedToday} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.data.processingStats.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Avg time: {(data.data.processingStats.avgProcessingTime / 1000).toFixed(1)}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.data.processingStats.queueDepth}</div>
            <p className="text-xs text-muted-foreground">pending jobs</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="files">File Processing</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MemoryStick className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="text-sm">Memory</span>
                  </div>
                  <span className="text-sm font-medium">{data.data.systemHealth.memoryUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${data.data.systemHealth.memoryUsage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Cpu className="h-4 w-4 mr-2 text-green-600" />
                    <span className="text-sm">CPU</span>
                  </div>
                  <span className="text-sm font-medium">{data.data.systemHealth.cpuUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${data.data.systemHealth.cpuUsage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <HardDrive className="h-4 w-4 mr-2 text-purple-600" />
                    <span className="text-sm">Disk</span>
                  </div>
                  <span className="text-sm font-medium">{data.data.systemHealth.diskUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${data.data.systemHealth.diskUsage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Active Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>{data.data.activeAlerts.length} active</CardDescription>
              </CardHeader>
              <CardContent>
                {data.data.activeAlerts.length === 0 ? (
                  <p className="text-gray-500">No active alerts</p>
                ) : (
                  <div className="space-y-3">
                    {data.data.activeAlerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center">
                            <Badge
                              variant={alert.rule.severity === 'critical' ? 'destructive' : 'secondary'}
                              className="mr-2"
                            >
                              {alert.rule.severity}
                            </Badge>
                            <span className="text-sm font-medium">{alert.rule.name}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Errors */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>{data.data.recentErrors.length} error types</CardDescription>
              </CardHeader>
              <CardContent>
                {data.data.recentErrors.length === 0 ? (
                  <p className="text-gray-500">No recent errors</p>
                ) : (
                  <div className="space-y-3">
                    {data.data.recentErrors.slice(0, 5).map((error, index) => (
                      <div key={index} className="border-l-4 border-red-400 pl-3">
                        <div className="text-sm font-medium">{error.errorType}</div>
                        <div className="text-xs text-gray-600">
                          {error.count} occurrences, {error.affectedFiles} files affected
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>Health Check Status</CardTitle>
              <CardDescription>Detailed status of all system components</CardDescription>
            </CardHeader>
            <CardContent>
              {data.detailed?.healthChecks ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(data.detailed.healthChecks).map(([name, check]) => (
                    <Card key={name} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{name}</span>
                          {getStatusIcon(check.status)}
                        </div>
                        <p className="text-sm text-gray-600">{check.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Last checked: {new Date(check.timestamp).toLocaleTimeString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Health check data not available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alert Management</CardTitle>
              <CardDescription>
                {data.detailed?.alertStats ? (
                  `${data.detailed.alertStats.activeAlerts} active alerts from ${data.detailed.alertStats.enabledRules} enabled rules`
                ) : (
                  'Alert system status'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.data.activeAlerts.map((alert) => (
                  <Card key={alert.id} className="border-l-4 border-l-red-400">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center mb-1">
                            <Badge
                              variant={alert.rule.severity === 'critical' ? 'destructive' : 'secondary'}
                              className="mr-2"
                            >
                              {alert.rule.severity}
                            </Badge>
                            <span className="font-medium">{alert.rule.name}</span>
                          </div>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          Resolve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {data.data.activeAlerts.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No active alerts</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>File Processing Distribution</CardTitle>
              <CardDescription>Processing statistics by file type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">File Type</th>
                      <th className="text-right py-2">Count</th>
                      <th className="text-right py-2">Success Rate</th>
                      <th className="text-right py-2">Avg Time</th>
                      <th className="text-right py-2">Total Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.fileTypeDistribution.map((fileType, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{fileType.fileType.toUpperCase()}</td>
                        <td className="text-right py-2">{fileType.count}</td>
                        <td className="text-right py-2">{(fileType.successRate * 100).toFixed(1)}%</td>
                        <td className="text-right py-2">{(fileType.avgProcessingTime / 1000).toFixed(1)}s</td>
                        <td className="text-right py-2">{(fileType.totalSize / 1024 / 1024).toFixed(1)} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
              <CardDescription>Detailed breakdown of processing errors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.data.recentErrors.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No errors in the selected timeframe</p>
                ) : (
                  data.data.recentErrors.map((error, index) => (
                    <Card key={index} className="border-l-4 border-l-orange-400">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm font-medium text-gray-600">Error Type</div>
                            <div className="font-medium">{error.errorType}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-600">Occurrences</div>
                            <div className="font-medium">{error.count}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-600">Affected Files</div>
                            <div className="font-medium">{error.affectedFiles}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-600">Last Occurrence</div>
                            <div className="font-medium text-sm">
                              {new Date(error.lastOccurrence).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}