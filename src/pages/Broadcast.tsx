import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Broadcast {
  id: string;
  name: string;
  message: string;
  status: string;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  created_at: string;
}

export const Broadcast = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    device_id: "",
    target_contacts: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: broadcastData } = await supabase
        .from("broadcasts")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: deviceData } = await supabase
        .from("devices")
        .select("*")
        .eq("status", "connected");

      setBroadcasts(broadcastData || []);
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

      const { error } = await supabase.from("broadcasts").insert({
        user_id: user.id,
        device_id: formData.device_id,
        name: formData.name,
        message: formData.message,
        target_contacts: formData.target_contacts,
        status: "draft",
      });

      if (error) throw error;

      toast.success("Broadcast berhasil dibuat");
      setDialogOpen(false);
      setFormData({ name: "", message: "", device_id: "", target_contacts: [] });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success text-success-foreground";
      case "processing":
        return "bg-warning text-warning-foreground";
      case "failed":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle2;
      case "processing":
        return Clock;
      case "failed":
        return XCircle;
      default:
        return Clock;
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Broadcast</h1>
            <p className="text-muted-foreground">
              Kirim pesan ke banyak kontak sekaligus
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                <Plus className="w-4 h-4 mr-2" />
                Buat Broadcast
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Broadcast Baru</DialogTitle>
                <DialogDescription>
                  Kirim pesan ke multiple kontak sekaligus
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Campaign</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Promo Bulan Ini"
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
                  <Label htmlFor="message">Pesan</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tulis pesan broadcast..."
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Buat Broadcast
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {broadcasts.map((broadcast) => {
            const StatusIcon = getStatusIcon(broadcast.status);
            return (
              <Card key={broadcast.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{broadcast.name}</CardTitle>
                      <CardDescription className="mt-2">
                        {broadcast.message.substring(0, 100)}...
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(broadcast.status)}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {broadcast.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Terkirim</p>
                      <p className="text-lg font-semibold">{broadcast.sent_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gagal</p>
                      <p className="text-lg font-semibold">{broadcast.failed_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dibuat</p>
                      <p className="text-sm">{new Date(broadcast.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Broadcast;
