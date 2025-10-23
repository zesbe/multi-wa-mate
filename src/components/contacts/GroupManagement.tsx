import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  is_group: boolean;
}

interface GroupManagementProps {
  onGroupCreated: () => void;
}

export function GroupManagement({ onGroupCreated }: GroupManagementProps) {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("is_group", false)
        .order("name");

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat kontak");
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      toast.error("Nama grup harus diisi");
      return;
    }

    if (selectedMembers.length === 0) {
      toast.error("Pilih minimal 1 anggota grup");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get member details
      const members = contacts
        .filter(c => selectedMembers.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name || c.phone_number,
          phone_number: c.phone_number,
        }));

      // Create group with phone number as concatenated member numbers
      const groupPhoneId = members.map(m => m.phone_number).join('@');

      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        device_id: "",
        name: groupName,
        phone_number: groupPhoneId,
        is_group: true,
        group_members: members,
      });

      if (error) throw error;

      toast.success(`Grup "${groupName}" berhasil dibuat dengan ${members.length} anggota`);
      setOpen(false);
      setGroupName("");
      setSelectedMembers([]);
      onGroupCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (contactId: string) => {
    setSelectedMembers(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="w-4 h-4" />
          Buat Grup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat Grup Kontak</DialogTitle>
          <DialogDescription>
            Buat grup untuk mengirim broadcast ke banyak kontak sekaligus
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Nama Grup</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Contoh: Tim Marketing, Pelanggan VIP"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Pilih Anggota ({selectedMembers.length} dipilih)</Label>
            <Input
              placeholder="Cari kontak..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-lg p-4">
            {filteredContacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Tidak ada kontak ditemukan
              </p>
            ) : (
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <Checkbox
                      checked={selectedMembers.includes(contact.id)}
                      onCheckedChange={() => toggleMember(contact.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {contact.name || contact.phone_number}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.phone_number}
                      </p>
                    </div>
                    {selectedMembers.includes(contact.id) && (
                      <Badge variant="secondary" className="text-xs">
                        Dipilih
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-accent rounded-lg">
              {selectedMembers.map(memberId => {
                const contact = contacts.find(c => c.id === memberId);
                if (!contact) return null;
                return (
                  <Badge key={memberId} variant="secondary" className="gap-1">
                    {contact.name || contact.phone_number}
                    <button
                      type="button"
                      onClick={() => toggleMember(memberId)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedMembers.length === 0}
              className="flex-1"
            >
              {loading ? "Membuat..." : "Buat Grup"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
