import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Calendar,
  Activity,
  Radio,
  Smartphone,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap,
  Globe
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface AnalyticsData {
  totalBroadcasts: number;
  totalMessages: number;
  successRate: number;
  failureRate: number;
  totalContacts: number;
  activeDevices: number;
  scheduledBroadcasts: number;
  messagesThisMonth: number;
  messagesLastMonth: number;
  broadcastsThisWeek: number;
  recentBroadcasts: any[];
  deviceStats: any[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  color?: string;
  delay?: number;
}

const AnalyticsStatCard = ({ title, value, icon: Icon, trend, trendLabel, color = "primary", delay = 0 }: StatCardProps) => {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 shadow-lg hover-lift animate-fade-in",
        "bg-gradient-to-br from-card to-card/80"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                ) : isNegative ? (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                ) : (
                  <Activity className="w-4 h-4 text-gray-500" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-gray-500"
                )}>
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
                {trendLabel && (
                  <span className="text-xs text-muted-foreground">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            color === "primary" && "bg-gradient-to-br from-primary/10 to-primary/20",
            color === "success" && "bg-gradient-to-br from-green-500/10 to-green-500/20",
            color === "warning" && "bg-gradient-to-br from-yellow-500/10 to-yellow-500/20",
            color === "danger" && "bg-gradient-to-br from-red-500/10 to-red-500/20",
          )}>
            <Icon className={cn(
              "w-6 h-6 animate-float",
              color === "primary" && "text-primary",
              color === "success" && "text-green-500",
              color === "warning" && "text-yellow-500",
              color === "danger" && "text-red-500",
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalBroadcasts: 0,
    totalMessages: 0,
    successRate: 0,
    failureRate: 0,
    totalContacts: 0,
    activeDevices: 0,
    scheduledBroadcasts: 0,
    messagesThisMonth: 0,
    messagesLastMonth: 0,
    broadcastsThisWeek: 0,
    recentBroadcasts: [],
    deviceStats: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch broadcasts
      const { data: broadcasts, error: broadcastsError } = await supabase
        .from("broadcasts")
        .select("*")
        .order("created_at", { ascending: false });

      if (broadcastsError) throw broadcastsError;

      // Fetch messages
      const { count: messagesCount } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true });

      // Fetch contacts
      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });

      // Fetch devices
      const { data: devices, error: devicesError } = await supabase
        .from("devices")
        .select("*");

      if (devicesError) throw devicesError;

      // Calculate statistics
      const totalSent = broadcasts?.reduce((sum, b) => sum + (b.sent_count || 0), 0) || 0;
      const totalFailed = broadcasts?.reduce((sum, b) => sum + (b.failed_count || 0), 0) || 0;
      const totalMessages = totalSent + totalFailed;
      const successRate = totalMessages > 0 ? Math.round((totalSent / totalMessages) * 100) : 0;
      const failureRate = 100 - successRate;

      const activeDevices = devices?.filter(d => d.status === "connected").length || 0;
      const scheduledBroadcasts = broadcasts?.filter(b => b.status === "draft").length || 0;

      // Get this month's messages
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const messagesThisMonth = broadcasts?.filter(b =>
        new Date(b.created_at) >= firstDayThisMonth
      ).reduce((sum, b) => sum + (b.sent_count || 0), 0) || 0;

      const messagesLastMonth = broadcasts?.filter(b => {
        const date = new Date(b.created_at);
        return date >= firstDayLastMonth && date <= lastDayLastMonth;
      }).reduce((sum, b) => sum + (b.sent_count || 0), 0) || 0;

      // Get this week's broadcasts
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const broadcastsThisWeek = broadcasts?.filter(b =>
        new Date(b.created_at) >= oneWeekAgo
      ).length || 0;

      // Get recent broadcasts for the table
      const recentBroadcasts = broadcasts?.slice(0, 10) || [];

      // Device stats
      const deviceStats = devices?.map(d => ({
        id: d.id,
        name: d.device_name,
        status: d.status,
        messagesSent: broadcasts?.filter(b => b.device_id === d.id).reduce((sum, b) => sum + (b.sent_count || 0), 0) || 0,
      })) || [];

      setAnalytics({
        totalBroadcasts: broadcasts?.length || 0,
        totalMessages: totalSent,
        successRate,
        failureRate,
        totalContacts: contactsCount || 0,
        activeDevices,
        scheduledBroadcasts,
        messagesThisMonth,
        messagesLastMonth,
        broadcastsThisWeek,
        recentBroadcasts,
        deviceStats,
      });
    } catch (error: any) {
      toast.error("Gagal memuat data analytics");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const monthTrend = analytics.messagesLastMonth > 0
    ? Math.round(((analytics.messagesThisMonth - analytics.messagesLastMonth) / analytics.messagesLastMonth) * 100)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "processing":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "cancelled":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Selesai";
      case "processing":
        return "Proses";
      case "failed":
        return "Gagal";
      case "cancelled":
        return "Dibatalkan";
      default:
        return "Draft";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Memuat analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
              Analytics Dashboard
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Monitor kinerja broadcast dan pesan WhatsApp Anda
            </p>
          </div>
          <div className="flex gap-2">
            <Badge
              variant={timeRange === "week" ? "default" : "outline"}
              className="cursor-pointer px-4 py-2"
              onClick={() => setTimeRange("week")}
            >
              Minggu Ini
            </Badge>
            <Badge
              variant={timeRange === "month" ? "default" : "outline"}
              className="cursor-pointer px-4 py-2"
              onClick={() => setTimeRange("month")}
            >
              Bulan Ini
            </Badge>
            <Badge
              variant={timeRange === "year" ? "default" : "outline"}
              className="cursor-pointer px-4 py-2"
              onClick={() => setTimeRange("year")}
            >
              Tahun Ini
            </Badge>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <AnalyticsStatCard
            title="Total Pesan Terkirim"
            value={analytics.totalMessages}
            icon={Send}
            trend={monthTrend}
            trendLabel="vs bulan lalu"
            color="primary"
            delay={0}
          />
          <AnalyticsStatCard
            title="Success Rate"
            value={`${analytics.successRate}%`}
            icon={CheckCircle2}
            trend={analytics.successRate - 90}
            trendLabel="target 90%"
            color="success"
            delay={100}
          />
          <AnalyticsStatCard
            title="Total Kontak"
            value={analytics.totalContacts}
            icon={Users}
            trend={15}
            trendLabel="bulan ini"
            color="primary"
            delay={200}
          />
          <AnalyticsStatCard
            title="Device Aktif"
            value={analytics.activeDevices}
            icon={Radio}
            color="success"
            delay={300}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-primary" />
                Campaign Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Broadcast</span>
                <span className="text-2xl font-bold">{analytics.totalBroadcasts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Terjadwal</span>
                <span className="text-2xl font-bold text-yellow-500">{analytics.scheduledBroadcasts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Minggu Ini</span>
                <span className="text-2xl font-bold text-green-500">{analytics.broadcastsThisWeek}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Delivery Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Berhasil</span>
                  <span className="font-medium text-green-500">{analytics.successRate}%</span>
                </div>
                <Progress value={analytics.successRate} className="h-3 bg-green-100" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gagal</span>
                  <span className="font-medium text-red-500">{analytics.failureRate}%</span>
                </div>
                <Progress value={analytics.failureRate} className="h-3 bg-red-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-primary" />
                Performa Bulan Ini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg">
                <p className="text-3xl font-bold text-primary">{analytics.messagesThisMonth}</p>
                <p className="text-sm text-muted-foreground mt-1">Pesan terkirim</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                {monthTrend > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  monthTrend > 0 ? "text-green-500" : "text-red-500"
                )}>
                  {monthTrend > 0 ? '+' : ''}{monthTrend}% vs bulan lalu
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables and Charts */}
        <Tabs defaultValue="broadcasts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="broadcasts" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Recent Broadcasts
            </TabsTrigger>
            <TabsTrigger value="devices" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Device Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="broadcasts" className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  10 Broadcast Terakhir
                </CardTitle>
                <CardDescription>
                  Riwayat broadcast yang telah dilakukan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Campaign</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Terkirim</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Gagal</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.recentBroadcasts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-muted-foreground">
                            Belum ada broadcast
                          </td>
                        </tr>
                      ) : (
                        analytics.recentBroadcasts.map((broadcast) => (
                          <tr key={broadcast.id} className="border-b hover:bg-accent/50 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-medium">{broadcast.name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-xs">{broadcast.message}</p>
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={getStatusColor(broadcast.status)}>
                                {getStatusText(broadcast.status)}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="flex items-center justify-end gap-1 text-green-600">
                                <CheckCircle2 className="w-4 h-4" />
                                {broadcast.sent_count || 0}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="flex items-center justify-end gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                {broadcast.failed_count || 0}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {(broadcast.sent_count || 0) + (broadcast.failed_count || 0)}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(broadcast.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices" className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  Performa Device
                </CardTitle>
                <CardDescription>
                  Statistik pesan per device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.deviceStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Belum ada device terdaftar</p>
                    </div>
                  ) : (
                    analytics.deviceStats.map((device) => (
                      <div key={device.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  device.status === "connected" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200"
                                )}
                              >
                                {device.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{device.messagesSent}</p>
                          <p className="text-xs text-muted-foreground">pesan terkirim</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Info */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Tips Meningkatkan Success Rate</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Gunakan delay yang cukup antar pesan (5-10 detik)</li>
                  <li>• Pastikan nomor kontak valid dan aktif</li>
                  <li>• Hindari mengirim pesan spam atau konten yang melanggar kebijakan WhatsApp</li>
                  <li>• Gunakan pesan yang dipersonalisasi untuk meningkatkan engagement</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
