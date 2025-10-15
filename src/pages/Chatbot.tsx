import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Bot, Trash2, Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatbotRule {
  id: string;
  trigger_text: string;
  response_text: string;
  match_type: string;
  is_active: boolean;
  created_at: string;
}

export const Chatbot = () => {
  const [rules, setRules] = useState<ChatbotRule[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    device_id: "",
    trigger_text: "",
    response_text: "",
    match_type: "exact",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: rulesData } = await supabase
        .from("chatbot_rules")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: deviceData } = await supabase
        .from("devices")
        .select("*")
        .eq("status", "connected");

      setRules(rulesData || []);
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

      const { error } = await supabase.from("chatbot_rules").insert({
        user_id: user.id,
        device_id: formData.device_id,
        trigger_text: formData.trigger_text,
        response_text: formData.response_text,
        match_type: formData.match_type,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Rule berhasil dibuat");
      setDialogOpen(false);
      setFormData({ device_id: "", trigger_text: "", response_text: "", match_type: "exact" });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("chatbot_rules")
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
    if (!confirm("Yakin ingin menghapus rule ini?")) return;

    try {
      const { error } = await supabase.from("chatbot_rules").delete().eq("id", id);
      if (error) throw error;

      toast.success("Rule berhasil dihapus");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Auto Reply / Chatbot</h1>
            <p className="text-muted-foreground">
              Setup auto reply berdasarkan keyword tertentu
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Auto Reply Rule</DialogTitle>
                <DialogDescription>
                  Bot akan membalas otomatis saat menerima keyword ini
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
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
                  <Label htmlFor="trigger">Keyword Trigger</Label>
                  <Input
                    id="trigger"
                    value={formData.trigger_text}
                    onChange={(e) => setFormData({ ...formData, trigger_text: e.target.value })}
                    placeholder="halo / info / promo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matchType">Tipe Match</Label>
                  <Select
                    value={formData.match_type}
                    onValueChange={(value) => setFormData({ ...formData, match_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="starts_with">Starts With</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="response">Pesan Balasan</Label>
                  <Textarea
                    id="response"
                    value={formData.response_text}
                    onChange={(e) => setFormData({ ...formData, response_text: e.target.value })}
                    placeholder="Halo! Ada yang bisa kami bantu?"
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Simpan Rule</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule) => (
            <Card key={rule.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">"{rule.trigger_text}"</CardTitle>
                      <CardDescription className="text-xs">
                        {rule.match_type}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => handleToggle(rule.id, rule.is_active)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {rule.response_text}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDelete(rule.id)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Chatbot;
