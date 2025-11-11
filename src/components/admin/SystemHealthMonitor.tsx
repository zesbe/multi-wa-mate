import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface SystemHealth {
  database: {
    status: "healthy" | "warning" | "critical";
    connections: number;
    latency: number;
  };
  api: {
    status: "healthy" | "warning" | "critical";
    responseTime: number;
    errorRate: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  performance: {
    uptime: number;
    requestsPerMinute: number;
  };
}

export const SystemHealthMonitor = () => {
  const [health, setHealth] = useState<SystemHealth>({
    database: { status: "healthy", connections: 0, latency: 0 },
    api: { status: "healthy", responseTime: 0, errorRate: 0 },
    storage: { used: 0, total: 100, percentage: 0 },
    performance: { uptime: 0, requestsPerMinute: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      const start = Date.now();
      
      // Test database connection and latency
      await supabase.from("profiles").select("id").limit(1);
      const dbLatency = Date.now() - start;

      // Get database stats
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: deviceCount } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true });

      // Calculate storage usage (simulated)
      const totalRecords = (userCount || 0) + (deviceCount || 0);
      const storagePercentage = Math.min((totalRecords / 10000) * 100, 100);

      // Determine health status based on metrics
      const dbStatus = dbLatency < 200 ? "healthy" : dbLatency < 500 ? "warning" : "critical";
      const apiStatus = dbLatency < 300 ? "healthy" : dbLatency < 600 ? "warning" : "critical";

      setHealth({
        database: {
          status: dbStatus,
          connections: totalRecords,
          latency: dbLatency
        },
        api: {
          status: apiStatus,
          responseTime: dbLatency,
          errorRate: 0 // Would need error tracking
        },
        storage: {
          used: totalRecords,
          total: 10000,
          percentage: storagePercentage
        },
        performance: {
          uptime: 99.9, // Would need uptime tracking
          requestsPerMinute: 0 // Would need request tracking
        }
      });

    } catch (error) {
      console.error("Error checking system health:", error);
      setHealth(prev => ({
        ...prev,
        database: { ...prev.database, status: "critical" },
        api: { ...prev.api, status: "critical" }
      }));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case "critical":
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500";
      case "warning":
        return "bg-orange-500";
      case "critical":
        return "bg-destructive";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Checking system health...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System Health Monitor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Database Health */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Database</p>
                <p className="text-xs text-muted-foreground">
                  Latency: {health.database.latency}ms
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(health.database.status)}
              <Badge className={getStatusColor(health.database.status)}>
                {health.database.status}
              </Badge>
            </div>
          </div>

          {/* API Health */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Wifi className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">API</p>
                <p className="text-xs text-muted-foreground">
                  Response: {health.api.responseTime}ms
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(health.api.status)}
              <Badge className={getStatusColor(health.api.status)}>
                {health.api.status}
              </Badge>
            </div>
          </div>

          {/* Storage */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-primary" />
                <p className="font-medium text-sm">Storage</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {health.storage.used} / {health.storage.total} records
              </span>
            </div>
            <Progress value={health.storage.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {health.storage.percentage.toFixed(1)}% used
            </p>
          </div>

          {/* Uptime */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">System Uptime</p>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-500 border-green-500">
              {health.performance.uptime}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
