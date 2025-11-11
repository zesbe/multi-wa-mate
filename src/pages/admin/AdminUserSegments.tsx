import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Filter, Crown, Calendar, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserWithDetails {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  role: string;
  subscription: {
    plan_name: string;
    status: string;
    expires_at: string | null;
  } | null;
  device_count: number;
  message_count: number;
}

export const AdminUserSegments = () => {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [planFilter, statusFilter, activityFilter, users]);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at");

      if (!profiles) return;

      // Fetch roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map(p => p.id));

      // Fetch subscriptions
      const { data: subscriptions } = await supabase
        .from("user_subscriptions")
        .select("user_id, status, expires_at, plans(name)")
        .in("user_id", profiles.map(p => p.id))
        .eq("status", "active");

      // Fetch device counts
      const { data: devices } = await supabase
        .from("devices")
        .select("user_id")
        .in("user_id", profiles.map(p => p.id));

      // Fetch message counts
      const { data: messages } = await supabase
        .from("message_history")
        .select("user_id")
        .in("user_id", profiles.map(p => p.id));

      const deviceCountMap = new Map();
      devices?.forEach(d => {
        deviceCountMap.set(d.user_id, (deviceCountMap.get(d.user_id) || 0) + 1);
      });

      const messageCountMap = new Map();
      messages?.forEach(m => {
        messageCountMap.set(m.user_id, (messageCountMap.get(m.user_id) || 0) + 1);
      });

      const usersData: UserWithDetails[] = profiles.map(profile => {
        const role = roles?.find(r => r.user_id === profile.id);
        const subscription = subscriptions?.find(s => s.user_id === profile.id);

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          created_at: profile.created_at,
          role: role?.role || "user",
          subscription: subscription ? {
            plan_name: (subscription.plans as any)?.name || "Free",
            status: subscription.status,
            expires_at: subscription.expires_at
          } : null,
          device_count: deviceCountMap.get(profile.id) || 0,
          message_count: messageCountMap.get(profile.id) || 0
        };
      });

      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Plan filter
    if (planFilter !== "all") {
      if (planFilter === "no_plan") {
        filtered = filtered.filter(u => !u.subscription);
      } else {
        filtered = filtered.filter(u => u.subscription?.plan_name === planFilter);
      }
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        filtered = filtered.filter(u => 
          u.subscription && 
          u.subscription.expires_at &&
          new Date(u.subscription.expires_at) > new Date()
        );
      } else if (statusFilter === "expired") {
        filtered = filtered.filter(u => 
          u.subscription && 
          u.subscription.expires_at &&
          new Date(u.subscription.expires_at) <= new Date()
        );
      } else if (statusFilter === "no_subscription") {
        filtered = filtered.filter(u => !u.subscription);
      }
    }

    // Activity filter
    if (activityFilter !== "all") {
      if (activityFilter === "high") {
        filtered = filtered.filter(u => u.message_count > 100);
      } else if (activityFilter === "medium") {
        filtered = filtered.filter(u => u.message_count > 10 && u.message_count <= 100);
      } else if (activityFilter === "low") {
        filtered = filtered.filter(u => u.message_count > 0 && u.message_count <= 10);
      } else if (activityFilter === "inactive") {
        filtered = filtered.filter(u => u.message_count === 0);
      }
    }

    setFilteredUsers(filtered);
  };

  const uniquePlans = [...new Set(users.map(u => u.subscription?.plan_name).filter(Boolean))];

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Filter className="w-8 h-8 text-primary" />
            User Segmentation
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Filter and analyze users by different criteria
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{filteredUsers.length}</p>
                <p className="text-sm text-muted-foreground">Filtered Results</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {users.filter(u => u.subscription).length}
                </p>
                <p className="text-sm text-muted-foreground">With Subscription</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {users.filter(u => u.message_count > 0).length}
                </p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan</label>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="no_plan">No Plan</SelectItem>
                    {uniquePlans.map((plan) => (
                      <SelectItem key={plan} value={plan!}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Subscription Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="no_subscription">No Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Activity Level</label>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="high">High (&gt;100 msgs)</SelectItem>
                    <SelectItem value="medium">Medium (11-100 msgs)</SelectItem>
                    <SelectItem value="low">Low (1-10 msgs)</SelectItem>
                    <SelectItem value="inactive">Inactive (0 msgs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Filtered Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="font-semibold">{user.full_name || "No Name"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-muted-foreground" />
                        {user.subscription ? (
                          <Badge variant="outline">{user.subscription.plan_name}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">No Plan</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {user.message_count} messages
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(user.created_at).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUserSegments;
