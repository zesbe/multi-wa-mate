import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Webhook, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WebhookData {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  device_id: string;
  created_at: string;
}

const AVAILABLE_EVENTS = [
  { id: "message.received", label: "Message Received" },
  { id: "message.sent", label: "Message Sent" },
  { id: "message.failed", label: "Message Failed" },
  { id: "device.connected", label: "Device Connected" },
  { id: "device.disconnected", label: "Device Disconnected" },
];

export const Webhooks = () => {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    url: "",
    device_id: "",
    events: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: webhookData } = await supabase
        .from("webhooks")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: deviceData } = await supabase
        .from("devices")
        .select("*");

      setWebhooks((webhookData || []).map(w => ({
        ...w,
        events: Array.isArray(w.events) ? w.events.filter((e): e is string => typeof e === 'string') : []
      })));
      setDevices(deviceData || []);
    } catch (error: any) {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("webhooks").insert({
        user_id: user.id,
        device_id: formData.device_id,
        url: formData.url,
        events: formData.events,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Webhook berhasil dibuat");
      setDialogOpen(false);
      setFormData({ url: "", device_id: "", events: [] });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("webhooks")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success("Status berhasil diubah");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus webhook ini?")) return;

    try {
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) throw error;

      toast.success("Webhook berhasil dihapus");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleEvent = (eventId: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Webhooks</h1>
            <p className="text-muted-foreground">
              Kirim notifikasi ke URL eksternal saat event terjadi
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Webhook Baru</DialogTitle>
                <DialogDescription>
                  Webhook akan mengirim POST request ke URL yang ditentukan
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://your-app.com/webhook"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device">Device</Label>
                  <Select
                    value={formData.device_id}
                    onValueChange={(value) => setFormData({ ...formData, device_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih device" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.device_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="space-y-2">
                    {AVAILABLE_EVENTS.map((event) => (
                      <div key={event.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={event.id}
                          checked={formData.events.includes(event.id)}
                          onCheckedChange={() => toggleEvent(event.id)}
                        />
                        <label
                          htmlFor={event.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {event.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full">Simpan Webhook</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                      <Webhook className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{webhook.url}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {webhook.events.length} events subscribed
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={webhook.is_active}
                    onCheckedChange={() => handleToggle(webhook.id, webhook.is_active)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="text-xs px-2 py-1 bg-muted rounded-md"
                    >
                      {AVAILABLE_EVENTS.find((e) => e.id === event)?.label || event}
                    </span>
                  ))}
                </div>
                <Button
                  onClick={() => handleDelete(webhook.id)}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Webhooks;
