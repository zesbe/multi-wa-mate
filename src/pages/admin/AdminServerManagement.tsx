import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Server, Plus, RefreshCw, Activity, AlertTriangle,
  CheckCircle, XCircle, Settings, Trash2, Gauge,
  Globe, MapPin, Zap, TrendingUp
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface BackendServer {
  id: string;
  server_name: string;
  server_url: string;
  server_type: string;
  region: string | null;
  max_capacity: number;
  current_load: number;
  is_active: boolean;
  is_healthy: boolean;
  priority: number;
  api_key: string | null;
  last_health_check: string | null;
  health_check_failures: number;
  response_time: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export const AdminServerManagement = () => {
  const [servers, setServers] = useState<BackendServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<BackendServer | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    server_name: "",
    server_url: "",
    server_type: "vps",
    region: "",
    max_capacity: 50,
    priority: 5,
    api_key: ""
  });

  useEffect(() => {
    loadServers();
    // Refresh every 30 seconds
    const interval = setInterval(loadServers, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadServers = async () => {
    if (!loading) setRefreshing(true);
    
    try {
      const { data, error } = await supabase
        .from("backend_servers")
        .select("*")
        .order("priority", { ascending: false });

      if (error) throw error;
      setServers(data || []);
    } catch (error: any) {
      console.error("Error loading servers:", error);
      toast.error("Gagal memuat daftar server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingServer) {
        // Update existing server
        const { error } = await supabase
          .from("backend_servers")
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingServer.id);

        if (error) throw error;
        toast.success("Server berhasil diupdate");
      } else {
        // Create new server
        const { error } = await supabase
          .from("backend_servers")
          .insert([formData]);

        if (error) throw error;
        toast.success("Server berhasil ditambahkan");
      }

      setDialogOpen(false);
      resetForm();
      loadServers();
    } catch (error: any) {
      console.error("Error saving server:", error);
      toast.error(error.message || "Gagal menyimpan server");
    }
  };

  const resetForm = () => {
    setFormData({
      server_name: "",
      server_url: "",
      server_type: "vps",
      region: "",
      max_capacity: 50,
      priority: 5,
      api_key: ""
    });
    setEditingServer(null);
  };

  const handleEdit = (server: BackendServer) => {
    setEditingServer(server);
    setFormData({
      server_name: server.server_name,
      server_url: server.server_url,
      server_type: server.server_type,
      region: server.region || "",
      max_capacity: server.max_capacity,
      priority: server.priority,
      api_key: server.api_key || ""
    });
    setDialogOpen(true);
  };

  const handleToggleActive = async (server: BackendServer) => {
    try {
      const { error } = await supabase
        .from("backend_servers")
        .update({ 
          is_active: !server.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("id", server.id);

      if (error) throw error;
      toast.success(`Server ${!server.is_active ? "diaktifkan" : "dinonaktifkan"}`);
      loadServers();
    } catch (error: any) {
      console.error("Error toggling server:", error);
      toast.error("Gagal mengubah status server");
    }
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm("Yakin ingin menghapus server ini? Semua device yang ter-assign akan di-reassign otomatis.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("backend_servers")
        .delete()
        .eq("id", serverId);

      if (error) throw error;
      toast.success("Server berhasil dihapus");
      loadServers();
    } catch (error: any) {
      console.error("Error deleting server:", error);
      toast.error("Gagal menghapus server");
    }
  };

  const handleHealthCheck = async (server: BackendServer) => {
    try {
      setRefreshing(true);
      const startTime = Date.now();
      
      // Check health endpoint
      const response = await fetch(`${server.server_url}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok;

      // Update server status
      const { error } = await supabase
        .from("backend_servers")
        .update({
          is_healthy: isHealthy,
          response_time: responseTime,
          last_health_check: new Date().toISOString(),
          health_check_failures: isHealthy ? 0 : server.health_check_failures + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", server.id);

      if (error) throw error;

      // Log the check
      await supabase.from("server_logs").insert([{
        server_id: server.id,
        log_type: isHealthy ? "info" : "error",
        message: isHealthy ? "Health check passed" : "Health check failed",
        details: {
          response_time: responseTime,
          status_code: response.status
        }
      }]);

      toast.success(isHealthy ? "Server sehat ✓" : "Server bermasalah ✗");
      loadServers();
    } catch (error: any) {
      console.error("Error checking health:", error);
      
      // Mark as unhealthy on error
      await supabase
        .from("backend_servers")
        .update({
          is_healthy: false,
          last_health_check: new Date().toISOString(),
          health_check_failures: server.health_check_failures + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", server.id);

      toast.error("Gagal memeriksa kesehatan server");
      loadServers();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (server: BackendServer) => {
    if (!server.is_active) {
      return <XCircle className="w-5 h-5 text-gray-500" />;
    }
    if (!server.is_healthy) {
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const getStatusBadge = (server: BackendServer) => {
    if (!server.is_active) {
      return <Badge variant="outline" className="bg-gray-500/10">Nonaktif</Badge>;
    }
    if (!server.is_healthy) {
      return <Badge variant="outline" className="bg-red-500/10 text-red-500">Bermasalah</Badge>;
    }
    return <Badge variant="outline" className="bg-green-500/10 text-green-500">Aktif</Badge>;
  };

  const getLoadPercentage = (server: BackendServer) => {
    return (server.current_load / server.max_capacity) * 100;
  };

  const getResponseTimeColor = (responseTime: number) => {
    if (responseTime === 0) return "text-muted-foreground";
    if (responseTime < 100) return "text-green-500";
    if (responseTime < 300) return "text-yellow-500";
    if (responseTime < 500) return "text-orange-500";
    return "text-red-500";
  };

  const getResponseTimeText = (responseTime: number) => {
    if (responseTime === 0) return "N/A";
    return `${responseTime}ms`;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Memuat server...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Server className="w-8 h-8 text-primary" />
              Multi-Server Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Kelola multiple backend servers dengan load balancing otomatis
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadServers} disabled={refreshing} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Server
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>
                      {editingServer ? "Edit Server" : "Tambah Server Baru"}
                    </DialogTitle>
                    <DialogDescription>
                      Tambahkan backend server untuk load balancing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="server_name">Nama Server *</Label>
                      <Input
                        id="server_name"
                        placeholder="VPS Server 1"
                        value={formData.server_name}
                        onChange={(e) => setFormData({...formData, server_name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="server_url">URL Server *</Label>
                      <Input
                        id="server_url"
                        placeholder="https://server.com atau http://168.x.x.x:3000"
                        value={formData.server_url}
                        onChange={(e) => setFormData({...formData, server_url: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="server_type">Tipe Server *</Label>
                      <Select
                        value={formData.server_type}
                        onValueChange={(value) => setFormData({...formData, server_type: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="railway">Railway</SelectItem>
                          <SelectItem value="vps">VPS</SelectItem>
                          <SelectItem value="cloud">Cloud</SelectItem>
                          <SelectItem value="dedicated">Dedicated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Input
                        id="region"
                        placeholder="ID, SG, US, dll"
                        value={formData.region}
                        onChange={(e) => setFormData({...formData, region: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max_capacity">Max Capacity</Label>
                        <Input
                          id="max_capacity"
                          type="number"
                          min="1"
                          value={formData.max_capacity}
                          onChange={(e) => setFormData({...formData, max_capacity: parseInt(e.target.value)})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority (0-10)</Label>
                        <Input
                          id="priority"
                          type="number"
                          min="0"
                          max="10"
                          value={formData.priority}
                          onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api_key">API Key (Optional)</Label>
                      <Input
                        id="api_key"
                        type="password"
                        placeholder="API key untuk autentikasi"
                        value={formData.api_key}
                        onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit">
                      {editingServer ? "Update" : "Tambah"} Server
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Servers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{servers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Servers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {servers.filter(s => s.is_active && s.is_healthy).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {servers.reduce((sum, s) => sum + s.max_capacity, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Load
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {servers.reduce((sum, s) => sum + s.current_load, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Server List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {servers.map((server) => (
            <Card key={server.id} className={`${
              !server.is_active ? 'opacity-60' : ''
            } hover:shadow-lg transition-shadow`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(server)}
                    <div>
                      <CardTitle className="text-lg">{server.server_name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {server.server_url}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(server)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Server Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="outline">{server.server_type}</Badge>
                  </div>
                  {server.region && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Region:</span>
                      <span className="font-medium">{server.region}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Priority:</span>
                    <Badge variant="outline">{server.priority}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${getResponseTimeColor(server.response_time)}`} />
                    <span className="text-muted-foreground">Response:</span>
                    <span className={`font-medium ${getResponseTimeColor(server.response_time)}`}>
                      {getResponseTimeText(server.response_time)}
                    </span>
                  </div>
                </div>

                {/* Load Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Server Load</span>
                    <span className="font-medium">
                      {server.current_load} / {server.max_capacity}
                    </span>
                  </div>
                  <Progress value={getLoadPercentage(server)} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{getLoadPercentage(server).toFixed(1)}% utilized</span>
                    {server.health_check_failures > 0 && (
                      <span className="text-red-500">
                        {server.health_check_failures} failures
                      </span>
                    )}
                  </div>
                </div>

                {/* Last Check */}
                {server.last_health_check && (
                  <div className="text-xs text-muted-foreground">
                    Last checked: {new Date(server.last_health_check).toLocaleString('id-ID')}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleHealthCheck(server)}
                    disabled={refreshing}
                  >
                    <Activity className="w-4 h-4 mr-1" />
                    Health Check
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(server)}
                  >
                    {server.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(server)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(server.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {servers.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Server className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
                <div>
                  <h3 className="text-lg font-semibold">Belum ada server</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tambahkan server backend pertama untuk memulai
                  </p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Server
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};