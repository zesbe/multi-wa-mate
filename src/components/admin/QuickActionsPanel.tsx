import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UserPlus,
  Crown,
  Send,
  Zap,
  RefreshCcw,
  Settings,
  MessageSquare,
  BarChart3
} from "lucide-react";

export const QuickActionsPanel = () => {
  const navigate = useNavigate();
  const [extendDialog, setExtendDialog] = useState(false);
  const [broadcastDialog, setBroadcastDialog] = useState(false);
  const [userId, setUserId] = useState("");
  const [months, setMonths] = useState("1");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const quickActions = [
    {
      icon: UserPlus,
      label: "Add User",
      description: "Create new user account",
      action: () => navigate("/admin/users"),
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Crown,
      label: "Extend Subscription",
      description: "Quick subscription extension",
      action: () => setExtendDialog(true),
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Send,
      label: "Broadcast",
      description: "Send announcement to all users",
      action: () => setBroadcastDialog(true),
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: BarChart3,
      label: "View Analytics",
      description: "Check system metrics",
      action: () => navigate("/admin/dashboard"),
      color: "from-orange-500 to-red-500"
    },
    {
      icon: RefreshCcw,
      label: "Sync Data",
      description: "Refresh dashboard data",
      action: () => {
        window.location.reload();
        toast.success("Refreshing data...");
      },
      color: "from-teal-500 to-cyan-500"
    },
    {
      icon: Settings,
      label: "Manage Plans",
      description: "Edit subscription plans",
      action: () => navigate("/admin/plans"),
      color: "from-indigo-500 to-purple-500"
    }
  ];

  const handleExtendSubscription = async () => {
    try {
      if (!userId) {
        toast.error("User ID is required");
        return;
      }

      const durationMs = parseInt(months) * 30 * 24 * 60 * 60 * 1000;
      const newExpiresAt = new Date(Date.now() + durationMs);

      // Check if user has subscription
      const { data: existingSub } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (existingSub) {
        const currentExpiry = existingSub.expires_at 
          ? new Date(existingSub.expires_at)
          : new Date();
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        const extendedDate = new Date(baseDate.getTime() + durationMs);

        await supabase
          .from("user_subscriptions")
          .update({ expires_at: extendedDate.toISOString() })
          .eq("id", existingSub.id);

        toast.success(`Subscription extended until ${extendedDate.toLocaleDateString("id-ID")}`);
      } else {
        toast.error("No active subscription found for this user");
      }

      setExtendDialog(false);
      setUserId("");
      setMonths("1");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBroadcast = async () => {
    try {
      if (!broadcastMessage) {
        toast.error("Message is required");
        return;
      }

      // Create system alert for all admins
      await supabase.from("system_alerts").insert({
        alert_type: "broadcast",
        severity: "info",
        title: "Admin Broadcast",
        message: broadcastMessage,
      });

      toast.success("Broadcast sent successfully");
      setBroadcastDialog(false);
      setBroadcastMessage("");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start gap-2 hover:scale-105 transition-transform"
                onClick={action.action}
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} bg-opacity-10`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Extend Subscription Dialog */}
      <Dialog open={extendDialog} onOpenChange={setExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user UUID"
              />
            </div>
            <div>
              <Label>Extend by (months)</Label>
              <Input
                type="number"
                min="1"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <Button onClick={handleExtendSubscription} className="w-full">
              Extend Subscription
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastDialog} onOpenChange={setBroadcastDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Broadcast</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <Input
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Enter announcement message"
              />
            </div>
            <Button onClick={handleBroadcast} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Send Broadcast
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
