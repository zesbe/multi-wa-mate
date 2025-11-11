import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [searchTerm, filterAction, filterEntity, logs]);

  const fetchLogs = async () => {
    try {
      const { data: logsData, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      if (logsData) {
        // Fetch admin profiles separately
        const adminIds = [...new Set(logsData.map(log => log.admin_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", adminIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const logsWithProfiles = logsData.map(log => ({
          ...log,
          profiles: profilesMap.get(log.admin_id) || { full_name: "Unknown", email: "N/A" }
        }));

        setLogs(logsWithProfiles as any);
        setFilteredLogs(logsWithProfiles as any);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (log.profiles?.email || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterAction !== "all") {
      filtered = filtered.filter((log) => log.action === filterAction);
    }

    if (filterEntity !== "all") {
      filtered = filtered.filter((log) => log.entity_type === filterEntity);
    }

    setFilteredLogs(filtered);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-500";
      case "update":
        return "bg-blue-500";
      case "delete":
        return "bg-destructive";
      default:
        return "bg-gray-500";
    }
  };

  const uniqueActions = [...new Set(logs.map((log) => log.action))];
  const uniqueEntities = [...new Set(logs.map((log) => log.entity_type))];

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Track all admin activities and changes
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {uniqueEntities.map((entity) => (
                    <SelectItem key={entity} value={entity}>
                      {entity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <div className="text-center py-8">Loading logs...</div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{log.profiles?.full_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">{log.profiles?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.entity_type}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <details className="cursor-pointer">
                                <summary className="text-sm text-muted-foreground">View changes</summary>
                                <pre className="text-xs mt-2 p-2 bg-muted rounded">
                                  {JSON.stringify({ old: log.old_values, new: log.new_values }, null, 2)}
                                </pre>
                              </details>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View */}
                <div className="lg:hidden space-y-4">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No logs found
                    </div>
                  ) : (
                    filteredLogs.map((log) => (
                      <Card key={log.id}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold">{log.profiles?.full_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">{log.profiles?.email}</p>
                              </div>
                              <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{log.entity_type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString("id-ID", {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLogs;
