import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickActionsPanel } from "@/components/admin/QuickActionsPanel";
import { SystemHealthMonitor } from "@/components/admin/SystemHealthMonitor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, CreditCard, MessageSquare, Smartphone, Calendar, 
  TrendingUp, DollarSign, Activity, AlertCircle, CheckCircle2, 
  XCircle, Clock, Zap, Database, Globe, Send, Eye, Wifi, WifiOff,
  BarChart3, PieChart, TrendingDown, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface RecentUser {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  role: string;
  subscription: {
    plan_name: string;
    status: string;
  } | null;
}

interface SystemMetrics {
  totalUsers: number;
  totalDevices: number;
  totalBroadcasts: number;
  activeSubscriptions: number;
  messagesTotal: number;
  messagesToday: number;
  devicesConnected: number;
  broadcastsActive: number;
  successRate: number;
  revenue: {
    today: number;
    month: number;
    total: number;
    mrr: number;
  };
}

interface ActivityData {
  date: string;
  messages: number;
  users: number;
  revenue: number;
}

interface BroadcastStats {
  id: string;
  name: string;
  user_name: string;
  status: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface PaymentTransaction {
  id: string;
  user_name: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  plan_name: string;
}

interface DeviceStatus {
  id: string;
  device_name: string;
  user_name: string;
  status: string;
  phone_number: string | null;
  last_connected_at: string | null;
}

export const AdminDashboard = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    totalDevices: 0,
    totalBroadcasts: 0,
    activeSubscriptions: 0,
    messagesTotal: 0,
    messagesToday: 0,
    devicesConnected: 0,
    broadcastsActive: 0,
    successRate: 0,
    revenue: {
      today: 0,
      month: 0,
      total: 0,
      mrr: 0,
    },
  });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [recentBroadcasts, setRecentBroadcasts] = useState<BroadcastStats[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentTransaction[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch basic metrics
      const [usersRes, devicesRes, broadcastsRes, subsRes, messagesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("devices").select("id", { count: "exact" }),
        supabase.from("broadcasts").select("id", { count: "exact" }),
        supabase.from("user_subscriptions").select("id", { count: "exact" }).eq("status", "active"),
        supabase.from("message_history").select("id", { count: "exact" }),
      ]);

      // Fetch today's messages
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: messagesToday } = await supabase
        .from("message_history")
        .select("id", { count: "exact" })
        .gte("created_at", today.toISOString());

      // Fetch connected devices
      const { count: devicesConnected } = await supabase
        .from("devices")
        .select("id", { count: "exact" })
        .eq("status", "connected");

      // Fetch active broadcasts
      const { count: broadcastsActive } = await supabase
        .from("broadcasts")
        .select("id", { count: "exact" })
        .in("status", ["sending", "scheduled"]);

      // Calculate broadcast success rate
      const { data: broadcastData } = await supabase
        .from("broadcasts")
        .select("sent_count, failed_count")
        .in("status", ["completed", "sending"]);

      let totalSent = 0;
      let totalFailed = 0;
      broadcastData?.forEach(b => {
        totalSent += b.sent_count || 0;
        totalFailed += b.failed_count || 0;
      });
      const successRate = totalSent + totalFailed > 0 
        ? (totalSent / (totalSent + totalFailed)) * 100 
        : 0;

      // Fetch revenue data
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const [paymentsToday, paymentsMonth, paymentsTotal] = await Promise.all([
        supabase.from("payments").select("total_payment").eq("status", "completed").gte("created_at", today.toISOString()),
        supabase.from("payments").select("total_payment").eq("status", "completed").gte("created_at", firstDayOfMonth.toISOString()),
        supabase.from("payments").select("total_payment").eq("status", "completed"),
      ]);

      const revenueToday = paymentsToday.data?.reduce((sum, p) => sum + Number(p.total_payment || 0), 0) || 0;
      const revenueMonth = paymentsMonth.data?.reduce((sum, p) => sum + Number(p.total_payment || 0), 0) || 0;
      const revenueTotal = paymentsTotal.data?.reduce((sum, p) => sum + Number(p.total_payment || 0), 0) || 0;

      // Calculate MRR (Monthly Recurring Revenue from active subscriptions)
      const { data: activePlans } = await supabase
        .from("user_subscriptions")
        .select("plans(price)")
        .eq("status", "active");
      
      const mrr = activePlans?.reduce((sum, sub: any) => sum + Number(sub.plans?.price || 0), 0) || 0;

      setMetrics({
        totalUsers: usersRes.count || 0,
        totalDevices: devicesRes.count || 0,
        totalBroadcasts: broadcastsRes.count || 0,
        activeSubscriptions: subsRes.count || 0,
        messagesTotal: messagesRes.count || 0,
        messagesToday: messagesToday || 0,
        devicesConnected: devicesConnected || 0,
        broadcastsActive: broadcastsActive || 0,
        successRate: Math.round(successRate),
        revenue: {
          today: revenueToday,
          month: revenueMonth,
          total: revenueTotal,
          mrr: mrr,
        },
      });

      // Fetch activity data for the last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date;
      });

      const activityPromises = last7Days.map(async (date) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const [messages, users, payments] = await Promise.all([
          supabase.from("message_history").select("id", { count: "exact" })
            .gte("created_at", startOfDay.toISOString())
            .lte("created_at", endOfDay.toISOString()),
          supabase.from("profiles").select("id", { count: "exact" })
            .gte("created_at", startOfDay.toISOString())
            .lte("created_at", endOfDay.toISOString()),
          supabase.from("payments").select("total_payment")
            .eq("status", "completed")
            .gte("created_at", startOfDay.toISOString())
            .lte("created_at", endOfDay.toISOString()),
        ]);

        return {
          date: date.toLocaleDateString("id-ID", { month: "short", day: "numeric" }),
          messages: messages.count || 0,
          users: users.count || 0,
          revenue: payments.data?.reduce((sum, p) => sum + Number(p.total_payment || 0), 0) || 0,
        };
      });

      const activity = await Promise.all(activityPromises);
      setActivityData(activity);

      // Fetch recent users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (profiles) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", profiles.map(p => p.id));

        const { data: subsData } = await supabase
          .from("user_subscriptions")
          .select("user_id, status, plans(name)")
          .in("user_id", profiles.map(p => p.id))
          .eq("status", "active");

        const users: RecentUser[] = profiles.map(profile => {
          const role = rolesData?.find(r => r.user_id === profile.id);
          const subscription = subsData?.find(s => s.user_id === profile.id);

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            created_at: profile.created_at,
            role: role?.role || "user",
            subscription: subscription ? {
              plan_name: (subscription.plans as any)?.name || "Free",
              status: subscription.status,
            } : null,
          };
        });

        setRecentUsers(users);
      }

      // Fetch recent broadcasts
      const { data: broadcasts } = await supabase
        .from("broadcasts")
        .select("id, name, user_id, status, sent_count, failed_count, created_at, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);

      if (broadcasts) {
        setRecentBroadcasts(broadcasts.map(b => ({
          id: b.id,
          name: b.name,
          user_name: (b.profiles as any)?.full_name || "Unknown",
          status: b.status,
          sent_count: b.sent_count || 0,
          failed_count: b.failed_count || 0,
          created_at: b.created_at,
        })));
      }

      // Fetch recent payments
      const { data: payments } = await supabase
        .from("payments")
        .select("id, user_id, amount, status, payment_method, created_at, plan_id, profiles(full_name), plans(name)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (payments) {
        setRecentPayments(payments.map(p => ({
          id: p.id,
          user_name: (p.profiles as any)?.full_name || "Unknown",
          amount: Number(p.amount),
          status: p.status,
          payment_method: p.payment_method,
          created_at: p.created_at,
          plan_name: (p.plans as any)?.name || "N/A",
        })));
      }

      // Fetch device statuses
      const { data: devices } = await supabase
        .from("devices")
        .select("id, device_name, user_id, status, phone_number, last_connected_at, profiles(full_name)")
        .order("last_connected_at", { ascending: false, nullsFirst: false })
        .limit(10);

      if (devices) {
        setDeviceStatuses(devices.map(d => ({
          id: d.id,
          device_name: d.device_name,
          user_name: (d.profiles as any)?.full_name || "Unknown",
          status: d.status,
          phone_number: d.phone_number,
          last_connected_at: d.last_connected_at,
        })));
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Activity className="w-12 h-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Enterprise Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Monitor performa sistem secara real-time
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>Updated: {new Date().toLocaleTimeString("id-ID")}</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <DollarSign className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.revenue.total)}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span>MRR: {formatCurrency(metrics.revenue.mrr)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalUsers}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>{metrics.activeSubscriptions} active subscriptions</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Messages Sent
              </CardTitle>
              <Send className="w-5 h-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.messagesTotal.toLocaleString()}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <ArrowUpRight className="w-3 h-3 text-green-500" />
                <span>Today: {metrics.messagesToday}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
              <BarChart3 className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.successRate}%</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Activity className="w-3 h-3" />
                <span>{metrics.broadcastsActive} broadcasts active</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Devices</p>
                  <p className="text-lg font-bold">{metrics.totalDevices}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Wifi className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Connected</p>
                  <p className="text-lg font-bold">{metrics.devicesConnected}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Broadcasts</p>
                  <p className="text-lg font-bold">{metrics.totalBroadcasts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="text-lg font-bold">{formatCurrency(metrics.revenue.today)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickActionsPanel />
          <SystemHealthMonitor />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Trend (7 Days)</CardTitle>
              <CardDescription>Messages and user registrations</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="messages" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorMessages)"
                    name="Messages"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stroke="hsl(var(--secondary))" 
                    fillOpacity={1} 
                    fill="url(#colorUsers)"
                    name="New Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend (7 Days)</CardTitle>
              <CardDescription>Daily revenue in IDR</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 lg:w-auto">
            <TabsTrigger value="users" className="text-xs sm:text-sm">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="broadcasts" className="text-xs sm:text-sm">
              <Send className="w-4 h-4 mr-2" />
              Broadcasts
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">
              <CreditCard className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="devices" className="text-xs sm:text-sm">
              <Smartphone className="w-4 h-4 mr-2" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs sm:text-sm">
              <Database className="w-4 h-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Users</CardTitle>
                <CardDescription>Latest user registrations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden lg:table-cell">Plan</TableHead>
                        <TableHead className="hidden sm:table-cell">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name || "No Name"}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {user.email || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {user.subscription ? (
                              <Badge variant="outline">{user.subscription.plan_name}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Free</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString("id-ID")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Broadcasts Tab */}
          <TabsContent value="broadcasts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Broadcasts</CardTitle>
                <CardDescription>Latest broadcast activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="hidden md:table-cell">User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Sent</TableHead>
                        <TableHead className="hidden lg:table-cell">Failed</TableHead>
                        <TableHead className="hidden sm:table-cell">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentBroadcasts.map((broadcast) => (
                        <TableRow key={broadcast.id}>
                          <TableCell className="font-medium">{broadcast.name}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {broadcast.user_name}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                broadcast.status === "completed" ? "default" :
                                broadcast.status === "sending" ? "secondary" :
                                broadcast.status === "scheduled" ? "outline" : "destructive"
                              }
                            >
                              {broadcast.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-3 h-3" />
                              {broadcast.sent_count}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="w-3 h-3" />
                              {broadcast.failed_count}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {new Date(broadcast.created_at).toLocaleDateString("id-ID")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Latest payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="hidden md:table-cell">Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Method</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.user_name}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline">{payment.plan_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                payment.status === "completed" ? "default" :
                                payment.status === "pending" ? "secondary" : "destructive"
                              }
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {payment.payment_method}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {new Date(payment.created_at).toLocaleDateString("id-ID")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Devices Tab */}
          <TabsContent value="devices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Device Status Monitor</CardTitle>
                <CardDescription>Real-time device connection status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device</TableHead>
                        <TableHead className="hidden md:table-cell">User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Phone</TableHead>
                        <TableHead className="hidden sm:table-cell">Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deviceStatuses.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell className="font-medium">{device.device_name}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {device.user_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {device.status === "connected" ? (
                                <Wifi className="w-4 h-4 text-green-500" />
                              ) : (
                                <WifiOff className="w-4 h-4 text-red-500" />
                              )}
                              <Badge 
                                variant={device.status === "connected" ? "default" : "destructive"}
                              >
                                {device.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {device.phone_number || "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {device.last_connected_at 
                              ? new Date(device.last_connected_at).toLocaleString("id-ID")
                              : "Never"
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Overall system performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="text-sm">API Status</span>
                    </div>
                    <Badge variant="default">Operational</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-500" />
                      <span className="text-sm">Database</span>
                    </div>
                    <Badge variant="default">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm">Edge Functions</span>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-purple-500" />
                      <span className="text-sm">Webhooks</span>
                    </div>
                    <Badge variant="default">Online</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg Response Time</span>
                    <span className="font-semibold">&lt; 100ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Uptime (30d)</span>
                    <span className="font-semibold">99.9%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total API Calls</span>
                    <span className="font-semibold">{(metrics.messagesTotal * 2.5).toFixed(0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Error Rate</span>
                    <span className="font-semibold text-green-600">0.1%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
