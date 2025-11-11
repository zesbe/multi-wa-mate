import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, Bell, Send, CheckCircle2, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CommunicationGuide } from "@/components/admin/CommunicationGuide";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const AdminCommunication = () => {
  const [showGuide, setShowGuide] = useState(false);
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['communication-stats'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs, error } = await supabase
        .from('communication_logs')
        .select('*')
        .gte('sent_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      const totalSent = logs?.length || 0;
      const emailsSent = logs?.filter(l => l.type === 'email').length || 0;
      const notificationsSent = logs?.filter(l => l.type === 'notification').length || 0;
      const delivered = logs?.filter(l => l.status === 'delivered' || l.status === 'opened' || l.status === 'clicked').length || 0;
      const opened = logs?.filter(l => l.status === 'opened' || l.status === 'clicked').length || 0;
      const clicked = logs?.filter(l => l.status === 'clicked').length || 0;

      const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
      const openRate = totalSent > 0 ? (opened / totalSent) * 100 : 0;
      const clickRate = totalSent > 0 ? (clicked / totalSent) * 100 : 0;

      const recentMessages = logs?.slice(0, 10).map(log => ({
        id: log.id,
        type: log.type,
        subject: log.subject || 'No subject',
        recipient: log.recipient_email || log.recipient_phone || 'Unknown',
        status: log.status,
        sent_at: log.sent_at
      })) || [];

      const typeGroups = logs?.reduce((acc, log) => {
        const type = log.type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const messagesByType = Object.entries(typeGroups).map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count
      }));

      return {
        totalSent,
        emailsSent,
        notificationsSent,
        deliveryRate,
        openRate,
        clickRate,
        recentMessages,
        messagesByType
      };
    }
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading communication data...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              Communication Hub
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Manage and monitor all user communications
            </p>
          </div>
          <Dialog open={showGuide} onOpenChange={setShowGuide}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Panduan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Panduan Communication Hub</DialogTitle>
              </DialogHeader>
              <CommunicationGuide />
            </DialogContent>
          </Dialog>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Total Messages Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalSent.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Emails Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.emailsSent.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.totalSent ? ((stats.emailsSent / stats.totalSent) * 100).toFixed(1) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.notificationsSent.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.totalSent ? ((stats.notificationsSent / stats.totalSent) * 100).toFixed(1) : 0}% of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Delivery Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {stats?.deliveryRate.toFixed(1) || 0}%
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${stats?.deliveryRate || 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Open Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.openRate.toFixed(1) || 0}%</div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${stats?.openRate || 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Click Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.clickRate.toFixed(1) || 0}%</div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-secondary"
                  style={{ width: `${stats?.clickRate || 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Messages by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.messagesByType && stats.messagesByType.length > 0 ? stats.messagesByType.map((item) => {
                const percentage = stats.totalSent > 0 ? (item.count / stats.totalSent) * 100 : 0;
                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{item.type}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No message data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recentMessages && stats.recentMessages.length > 0 ? stats.recentMessages.map((msg) => (
                <div key={msg.id} className="border-b pb-3 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {msg.type === "email" ? (
                        <Mail className="w-4 h-4 text-primary" />
                      ) : (
                        <Bell className="w-4 h-4 text-secondary" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{msg.subject}</p>
                        <p className="text-xs text-muted-foreground">{msg.recipient}</p>
                      </div>
                    </div>
                    <Badge
                      variant={msg.status === "delivered" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {msg.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(msg.sent_at).toLocaleString("id-ID")}
                  </p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent messages
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCommunication;
