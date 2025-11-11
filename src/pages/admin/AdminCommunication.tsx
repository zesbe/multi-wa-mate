import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, Bell, Send, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CommunicationStats {
  totalSent: number;
  emailsSent: number;
  notificationsSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  recentMessages: Array<{
    id: string;
    type: string;
    subject: string;
    recipient: string;
    status: string;
    sent_at: string;
  }>;
  messagesByType: Array<{ type: string; count: number }>;
}

export const AdminCommunication = () => {
  const [data, setData] = useState<CommunicationStats>({
    totalSent: 0,
    emailsSent: 0,
    notificationsSent: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    recentMessages: [],
    messagesByType: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunicationStats();
  }, []);

  const fetchCommunicationStats = async () => {
    try {
      // Simulated data - in real app, fetch from communication_logs table
      const mockData: CommunicationStats = {
        totalSent: 1247,
        emailsSent: 823,
        notificationsSent: 424,
        deliveryRate: 98.5,
        openRate: 42.3,
        clickRate: 18.7,
        recentMessages: [
          {
            id: "1",
            type: "email",
            subject: "Welcome to Premium Plan",
            recipient: "user@example.com",
            status: "delivered",
            sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: "2",
            type: "notification",
            subject: "Subscription Expiring Soon",
            recipient: "john@example.com",
            status: "delivered",
            sent_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
          },
          {
            id: "3",
            type: "email",
            subject: "Payment Failed - Action Required",
            recipient: "jane@example.com",
            status: "opened",
            sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: "4",
            type: "notification",
            subject: "New Feature Available",
            recipient: "all_users",
            status: "delivered",
            sent_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
          }
        ],
        messagesByType: [
          { type: "Welcome", count: 156 },
          { type: "Subscription", count: 234 },
          { type: "Payment", count: 189 },
          { type: "Feature", count: 112 },
          { type: "Support", count: 98 },
          { type: "Marketing", count: 458 }
        ]
      };

      setData(mockData);
    } catch (error) {
      console.error("Error fetching communication stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
          <Button className="gap-2">
            <Send className="w-4 h-4" />
            Send Message
          </Button>
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
              <div className="text-2xl font-bold">{data.totalSent.toLocaleString()}</div>
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
              <div className="text-2xl font-bold">{data.emailsSent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((data.emailsSent / data.totalSent) * 100).toFixed(1)}% of total
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
              <div className="text-2xl font-bold">{data.notificationsSent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((data.notificationsSent / data.totalSent) * 100).toFixed(1)}% of total
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
                {data.deliveryRate.toFixed(1)}%
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${data.deliveryRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Open Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.openRate.toFixed(1)}%</div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${data.openRate}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Click Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.clickRate.toFixed(1)}%</div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-secondary"
                  style={{ width: `${data.clickRate}%` }}
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
              {data.messagesByType.map((item) => {
                const percentage = (item.count / data.totalSent) * 100;
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
              })}
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
              {data.recentMessages.map((msg) => (
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCommunication;
