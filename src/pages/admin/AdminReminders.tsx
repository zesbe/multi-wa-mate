import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Plus, Play, Pause, Trash2, Send, Clock, Users, TrendingUp, Calendar, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

interface ReminderConfig {
  id: string;
  name: string;
  description: string;
  reminder_type: string;
  trigger_days_before: number[];
  target_segment: string;
  message_template: string;
  is_active: boolean;
  auto_send: boolean;
  device_id: string;
  total_sent: number;
  last_sent_at: string;
  send_time: string;
}

interface Device {
  id: string;
  device_name: string;
  status: string;
}

export default function AdminReminders() {
  const [reminders, setReminders] = useState<ReminderConfig[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, sent_today: 0 });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    reminder_type: "subscription_renewal",
    trigger_days_before: [7, 3, 1],
    target_segment: "expiring_soon",
    message_template: "",
    device_id: "",
    auto_send: true,
    send_time: "10:00:00"
  });

  useEffect(() => {
    fetchReminders();
    fetchDevices();
    fetchStats();
  }, []);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from("reminder_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReminders(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat pengingat: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_name, status")
        .eq("status", "connected");

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to load devices:", error.message);
      }
    }
  };

  const fetchStats = async () => {
    try {
      const { data: configs } = await supabase
        .from("reminder_configs")
        .select("id, is_active, total_sent");

      const { data: logsToday } = await supabase
        .from("reminder_logs")
        .select("id")
        .gte("created_at", new Date().toISOString().split("T")[0]);

      setStats({
        total: configs?.length || 0,
        active: configs?.filter(c => c.is_active).length || 0,
        sent_today: logsToday?.length || 0
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to fetch stats:", error);
      }
    }
  };

  const handleCreateReminder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");

      const { error } = await supabase
        .from("reminder_configs")
        .insert({
          ...formData,
          created_by: user.id
        });

      if (error) throw error;

      toast.success("Pengingat berhasil dibuat!");
      setShowCreateDialog(false);
      fetchReminders();
      fetchStats();
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        reminder_type: "subscription_renewal",
        trigger_days_before: [7, 3, 1],
        target_segment: "expiring_soon",
        message_template: "",
        device_id: "",
        auto_send: true,
        send_time: "10:00:00"
      });
    } catch (error: any) {
      toast.error("Gagal membuat pengingat: " + error.message);
    }
  };

  const toggleReminderStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("reminder_configs")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(currentStatus ? "Pengingat dijeda" : "Pengingat diaktifkan");
      fetchReminders();
      fetchStats();
    } catch (error: any) {
      toast.error("Gagal memperbarui pengingat: " + error.message);
    }
  };

  const deleteReminder = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengingat ini?")) return;

    try {
      const { error } = await supabase
        .from("reminder_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Pengingat berhasil dihapus");
      fetchReminders();
      fetchStats();
    } catch (error: any) {
      toast.error("Gagal menghapus pengingat: " + error.message);
    }
  };

  const sendManualReminder = async () => {
    toast.info("Fitur pengingat manual - segera hadir!");
  };

  const reminderTypeLabels: Record<string, string> = {
    subscription_renewal: "Perpanjangan Langganan",
    payment_due: "Pembayaran Jatuh Tempo",
    custom: "Pengingat Kustom"
  };

  const targetSegmentLabels: Record<string, string> = {
    all: "Semua Pengguna",
    expiring_soon: "Akan Berakhir (< 7 hari)",
    expired: "Pengguna Kedaluwarsa",
    custom: "Segmen Kustom"
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              Manajemen Pengingat
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Pengingat WhatsApp otomatis untuk perpanjangan langganan dan pembayaran
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Buat Pengingat</span>
                <span className="sm:hidden">Buat</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Buat Pengingat Baru</DialogTitle>
                <DialogDescription>
                  Konfigurasi pengingat otomatis untuk pelanggan Anda
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Pengingat *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="contoh: Peringatan Langganan Berakhir"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Deskripsi singkat tentang pengingat ini"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reminder_type">Jenis Pengingat</Label>
                    <Select
                      value={formData.reminder_type}
                      onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subscription_renewal">Perpanjangan Langganan</SelectItem>
                        <SelectItem value="payment_due">Pembayaran Jatuh Tempo</SelectItem>
                        <SelectItem value="custom">Pengingat Kustom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_segment">Target Segmen</Label>
                    <Select
                      value={formData.target_segment}
                      onValueChange={(value) => setFormData({ ...formData, target_segment: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expiring_soon">Akan Berakhir (&lt; 7 hari)</SelectItem>
                        <SelectItem value="expired">Pengguna Kedaluwarsa</SelectItem>
                        <SelectItem value="all">Semua Pengguna</SelectItem>
                        <SelectItem value="custom">Segmen Kustom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="device">Perangkat WhatsApp *</Label>
                  <Select
                    value={formData.device_id}
                    onValueChange={(value) => setFormData({ ...formData, device_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih perangkat" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.device_name} ({device.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {devices.length === 0 && (
                    <p className="text-sm text-destructive">Tidak ada perangkat terhubung</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trigger_days">Hari Pemicu Sebelum Berakhir</Label>
                  <Input
                    id="trigger_days"
                    value={formData.trigger_days_before.join(", ")}
                    onChange={(e) => {
                      const days = e.target.value.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                      setFormData({ ...formData, trigger_days_before: days });
                    }}
                    placeholder="contoh: 7, 3, 1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Masukkan hari dipisahkan koma (contoh: 7, 3, 1 untuk pengingat 7, 3, dan 1 hari sebelum berakhir)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="send_time">Waktu Kirim</Label>
                  <Input
                    id="send_time"
                    type="time"
                    value={formData.send_time}
                    onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Template Pesan *</Label>
                  <Textarea
                    id="message"
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    placeholder="Hai {{nama}}, langganan Anda akan berakhir dalam {{hari}} hari. Harap perpanjang untuk terus menggunakan layanan kami."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gunakan variabel: {'{{nama}}'}, {'{{hari}}'}, {'{{paket}}'}, {'{{berakhir_pada}}'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_send"
                    checked={formData.auto_send}
                    onCheckedChange={(checked) => setFormData({ ...formData, auto_send: checked })}
                  />
                  <Label htmlFor="auto_send" className="cursor-pointer">
                    Aktifkan pengiriman otomatis
                  </Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleCreateReminder}
                    disabled={!formData.name || !formData.message_template || !formData.device_id}
                    className="flex-1"
                  >
                    Buat Pengingat
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pengingat</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.total}</p>
              </div>
              <Bell className="w-10 h-10 text-primary opacity-20" />
            </div>
          </Card>

          <Card className="p-6 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pengingat Aktif</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.active}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Terkirim Hari Ini</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.sent_today}</p>
              </div>
              <MessageSquare className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="automatic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="automatic" className="gap-2 text-xs sm:text-sm">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Pengingat Otomatis</span>
              <span className="sm:hidden">Otomatis</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2 text-xs sm:text-sm">
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Kirim Manual</span>
              <span className="sm:hidden">Manual</span>
            </TabsTrigger>
          </TabsList>

          {/* Automatic Reminders Tab */}
          <TabsContent value="automatic" className="space-y-4">
            {loading ? (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">Memuat pengingat...</div>
              </Card>
            ) : reminders.length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Belum ada pengingat yang dikonfigurasi</p>
                  <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2">
                    <Plus className="w-4 h-4" />
                    Buat Pengingat Pertama Anda
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {reminders.map((reminder) => (
                  <Card key={reminder.id} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{reminder.name}</h3>
                          <Badge variant={reminder.is_active ? "default" : "secondary"}>
                            {reminder.is_active ? "Aktif" : "Dijeda"}
                          </Badge>
                          {reminder.auto_send && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="w-3 h-3" />
                              Otomatis
                            </Badge>
                          )}
                        </div>
                        
                        {reminder.description && (
                          <p className="text-sm text-muted-foreground mb-3">{reminder.description}</p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Jenis</p>
                            <p className="font-medium text-foreground">
                              {reminderTypeLabels[reminder.reminder_type]}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Target</p>
                            <p className="font-medium text-foreground">
                              {targetSegmentLabels[reminder.target_segment]}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Hari Pemicu</p>
                            <p className="font-medium text-foreground">
                              {reminder.trigger_days_before.join(", ")} hari
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Terkirim</p>
                            <p className="font-medium text-foreground">{reminder.total_sent}</p>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Preview Pesan</p>
                          <p className="text-sm text-foreground line-clamp-2">{reminder.message_template}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => toggleReminderStatus(reminder.id, reminder.is_active)}
                          title={reminder.is_active ? "Jeda" : "Aktifkan"}
                        >
                          {reminder.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteReminder(reminder.id)}
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Manual Send Tab */}
          <TabsContent value="manual" className="space-y-4">
            <Card className="p-8">
              <div className="text-center max-w-md mx-auto">
                <Send className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">Kirim Pengingat Manual</h3>
                <p className="text-muted-foreground mb-6">
                  Kirim pesan pengingat sekali waktu dengan cepat ke pengguna atau segmen yang dipilih
                </p>
                <Button onClick={sendManualReminder} className="gap-2">
                  <Send className="w-4 h-4" />
                  Kirim Pengingat Manual
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
