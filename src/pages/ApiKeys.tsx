import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Key, Trash2, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hashApiKey, generateSecureApiKey, getApiKeyPrefix } from "@/utils/apiKeyHash";

interface ApiKey {
  id: string;
  key_name: string;
  api_key: string;
  api_key_hash: string;
  api_key_prefix: string;
  is_active: boolean;
  created_at: string;
}

interface NewApiKey extends ApiKey {
  plaintext_key?: string; // Only available once at creation
}

export const ApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [formData, setFormData] = useState({
    key_name: "",
  });

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApiKeys((data as any) || []);
    } catch (error: any) {
      toast.error("Gagal memuat API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Generate secure random API key
      const plaintextKey = generateSecureApiKey();
      
      // Hash the API key before storing
      const hashedKey = await hashApiKey(plaintextKey);
      const keyPrefix = getApiKeyPrefix(plaintextKey);

      const { error } = await supabase.from("api_keys").insert({
        key_name: formData.key_name,
        api_key: '', // Legacy field, will be removed
        api_key_hash: hashedKey,
        api_key_prefix: keyPrefix,
        is_active: true,
      } as any);

      if (error) throw error;

      // Show the plaintext key only once
      setNewlyCreatedKey(plaintextKey);
      setShowNewKeyDialog(true);
      
      toast.success("API Key berhasil dibuat");
      setDialogOpen(false);
      setFormData({ key_name: "" });
      fetchApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success("Status berhasil diubah");
      fetchApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus API key ini?")) return;

    try {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;

      toast.success("API Key berhasil dihapus");
      fetchApiKeys();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCopy = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API Key berhasil disalin");
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const displayApiKey = (apiKey: ApiKey) => {
    // For newly created keys, show plaintext if visible
    if (newlyCreatedKey && visibleKeys.has(apiKey.id)) {
      return newlyCreatedKey;
    }
    // For existing keys, show prefix + masked portion
    return `${apiKey.api_key_prefix || apiKey.api_key?.substring(0, 8) || 'wap_****'}${"*".repeat(24)}`;
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">API Keys</h1>
            <p className="text-muted-foreground">
              Kelola API keys untuk integrasi dengan aplikasi lain
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                <Plus className="w-4 h-4 mr-2" />
                Generate API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate API Key Baru</DialogTitle>
                <DialogDescription>
                  API key akan di-generate otomatis dan hanya ditampilkan sekali
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Nama API Key</Label>
                  <Input
                    id="keyName"
                    value={formData.key_name}
                    onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                    placeholder="Production API / Testing API"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Generate API Key</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                      <Key className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{apiKey.key_name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Created {new Date(apiKey.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={apiKey.is_active}
                    onCheckedChange={() => handleToggle(apiKey.id, apiKey.is_active)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="flex-1 text-sm font-mono">
                    {displayApiKey(apiKey)}
                  </code>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ API key disimpan dengan hash SHA-256. Simpan key Anda dengan aman, tidak bisa dilihat lagi setelah dibuat.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDelete(apiKey.id)}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus API Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {apiKeys.length === 0 && !loading && (
          <div className="text-center py-12">
            <Key className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              Belum ada API key. Generate yang pertama untuk memulai!
            </p>
          </div>
        )}

        {/* New API Key Display Dialog */}
        <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API Key Berhasil Dibuat! 🎉</DialogTitle>
              <DialogDescription>
                Simpan API key ini dengan aman. Anda tidak akan bisa melihatnya lagi setelah menutup dialog ini.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground mb-2 block">
                  API Key Anda:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono break-all bg-background p-2 rounded border">
                    {newlyCreatedKey}
                  </code>
                  <Button
                    onClick={() => {
                      if (newlyCreatedKey) {
                        navigator.clipboard.writeText(newlyCreatedKey);
                        toast.success("API Key berhasil disalin");
                      }
                    }}
                    variant="outline"
                    size="icon"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  ⚠️ <strong>Penting:</strong> API key ini hanya ditampilkan sekali. Pastikan Anda menyimpannya di tempat yang aman sebelum menutup dialog ini.
                </p>
              </div>
              <Button 
                onClick={() => {
                  setShowNewKeyDialog(false);
                  setNewlyCreatedKey(null);
                }}
                className="w-full"
              >
                Saya Sudah Menyimpannya
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ApiKeys;
