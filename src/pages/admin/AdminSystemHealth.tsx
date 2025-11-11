import { AdminLayout } from "@/components/AdminLayout";
import { SystemHealthMonitor } from "@/components/admin/SystemHealthMonitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Server, Database, Zap } from "lucide-react";

export const AdminSystemHealth = () => {
  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />
            System Health
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Real-time system monitoring and performance metrics
          </p>
        </div>

        <SystemHealthMonitor />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                Server Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Region:</span>
                  <span className="font-medium">Asia Southeast</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Load:</span>
                  <span className="font-medium text-green-500">Low</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4" />
                Database
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-medium">PostgreSQL 15</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Connections:</span>
                  <span className="font-medium">5/100</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Response:</span>
                  <span className="font-medium">45ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Error Rate:</span>
                  <span className="font-medium text-green-500">0.01%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSystemHealth;
