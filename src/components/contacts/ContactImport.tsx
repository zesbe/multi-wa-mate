import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, AlertCircle, Contact, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface ContactData {
  name: string;
  phone_number: string;
  is_group: boolean;
}

interface ContactImportProps {
  onImportComplete: () => void;
}

export function ContactImport({ onImportComplete }: ContactImportProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const normalizePhone = (phone: string): string => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Convert local Indonesian format to international
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    
    // Ensure it starts with country code
    if (!cleaned.startsWith('62') && cleaned.length > 9) {
      cleaned = '62' + cleaned;
    }
    
    return cleaned;
  };

  const importContacts = async (contacts: ContactData[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < contacts.length; i++) {
      try {
        const contact = contacts[i];
        const normalizedPhone = normalizePhone(contact.phone_number);

        if (normalizedPhone.length < 10) {
          errorCount++;
          continue;
        }

        // Check if contact already exists
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", user.id)
          .eq("phone_number", normalizedPhone)
          .maybeSingle();

        if (existing) {
          // Update existing contact
          await supabase
            .from("contacts")
            .update({
              name: contact.name,
              is_group: contact.is_group,
            })
            .eq("id", existing.id);
        } else {
          // Insert new contact
          await supabase.from("contacts").insert({
            user_id: user.id,
            device_id: "",
            name: contact.name,
            phone_number: normalizedPhone,
            is_group: contact.is_group,
          });
        }

        successCount++;
        setProgress(Math.round(((i + 1) / contacts.length) * 100));
      } catch (error) {
        console.error("Error importing contact:", error);
        errorCount++;
      }
    }

    return { successCount, errorCount };
  };

  const handleGoogleContactsCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(Boolean);
      
      if (lines.length < 2) {
        throw new Error("File CSV kosong atau tidak valid");
      }

      // Parse CSV header
      const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const nameIndex = header.findIndex(h => h.includes('name') || h.includes('given'));
      const phoneIndex = header.findIndex(h => h.includes('phone'));

      if (phoneIndex === -1) {
        throw new Error("Kolom nomor telepon tidak ditemukan");
      }

      const contacts: ContactData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const phone = values[phoneIndex];
        const name = nameIndex >= 0 ? values[nameIndex] : phone;

        if (phone && phone.length > 5) {
          contacts.push({
            name: name || phone,
            phone_number: phone,
            is_group: false,
          });
        }
      }

      const { successCount, errorCount } = await importContacts(contacts);
      
      toast.success(`✅ ${successCount} kontak berhasil diimport${errorCount > 0 ? `, ${errorCount} gagal` : ''}`);
      setOpen(false);
      onImportComplete();
    } catch (error: any) {
      toast.error("Gagal import: " + error.message);
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  const handleVCardImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);

    try {
      const text = await file.text();
      const vCards = text.split('BEGIN:VCARD').filter(Boolean);
      
      const contacts: ContactData[] = [];
      
      vCards.forEach(vCard => {
        let name = '';
        let phone = '';
        
        const lines = vCard.split('\n');
        lines.forEach(line => {
          if (line.startsWith('FN:') || line.startsWith('N:')) {
            name = line.split(':')[1]?.trim() || name;
          }
          if (line.startsWith('TEL')) {
            const telLine = line.split(':');
            if (telLine.length > 1) {
              phone = telLine[telLine.length - 1].trim();
            }
          }
        });

        if (phone) {
          contacts.push({
            name: name || phone,
            phone_number: phone,
            is_group: false,
          });
        }
      });

      if (contacts.length === 0) {
        throw new Error("Tidak ada kontak valid ditemukan");
      }

      const { successCount, errorCount } = await importContacts(contacts);
      
      toast.success(`✅ ${successCount} kontak berhasil diimport${errorCount > 0 ? `, ${errorCount} gagal` : ''}`);
      setOpen(false);
      onImportComplete();
    } catch (error: any) {
      toast.error("Gagal import vCard: " + error.message);
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  const handleSimpleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      
      const contacts: ContactData[] = [];
      lines.forEach(line => {
        const parts = line.split(/[,;\t]/).map(p => p.trim());
        
        if (parts.length >= 2) {
          // Format: Name, Phone
          contacts.push({
            name: parts[0],
            phone_number: parts[1],
            is_group: false,
          });
        } else if (parts.length === 1) {
          // Only phone number
          const cleaned = parts[0].replace(/[^\d+]/g, '');
          if (cleaned.length >= 10) {
            contacts.push({
              name: cleaned,
              phone_number: cleaned,
              is_group: false,
            });
          }
        }
      });

      if (contacts.length === 0) {
        throw new Error("Tidak ada kontak valid ditemukan");
      }

      const { successCount, errorCount } = await importContacts(contacts);
      
      toast.success(`✅ ${successCount} kontak berhasil diimport${errorCount > 0 ? `, ${errorCount} gagal` : ''}`);
      setOpen(false);
      onImportComplete();
    } catch (error: any) {
      toast.error("Gagal import: " + error.message);
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          Import Kontak
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Kontak</DialogTitle>
          <DialogDescription>
            Import kontak dari Google Contacts, WhatsApp, atau file lainnya
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="google" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="google">Google Contacts</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp (vCard)</TabsTrigger>
            <TabsTrigger value="simple">File Sederhana</TabsTrigger>
          </TabsList>
          
          <TabsContent value="google" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Cara export dari Google Contacts:</strong>
                <ol className="mt-2 list-decimal list-inside space-y-1">
                  <li>Buka contacts.google.com</li>
                  <li>Pilih kontak yang ingin diexport</li>
                  <li>Klik Export → Google CSV</li>
                  <li>Upload file CSV di sini</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleGoogleContactsCSV}
                disabled={importing}
                className="hidden"
                id="google-csv-upload"
              />
              <label htmlFor="google-csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {importing ? "Mengimport..." : "Upload Google CSV"}
                </p>
                <p className="text-xs text-muted-foreground">Format: Google CSV</p>
              </label>
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Cara export dari WhatsApp:</strong>
                <ol className="mt-2 list-decimal list-inside space-y-1">
                  <li>Buka WhatsApp di HP</li>
                  <li>Settings → Chats → Export Chat</li>
                  <li>Pilih kontak/grup → Without Media</li>
                  <li>Save file .vcf dan upload di sini</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors">
              <input
                type="file"
                accept=".vcf,.vcard"
                onChange={handleVCardImport}
                disabled={importing}
                className="hidden"
                id="vcard-upload"
              />
              <label htmlFor="vcard-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Contact className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {importing ? "Mengimport..." : "Upload vCard File"}
                </p>
                <p className="text-xs text-muted-foreground">Format: .vcf atau .vcard</p>
              </label>
            </div>
          </TabsContent>

          <TabsContent value="simple" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Format file sederhana:</strong>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>CSV atau TXT</li>
                  <li>Format: Nama,Nomor atau hanya Nomor</li>
                  <li>Contoh: John Doe,628123456789</li>
                  <li>Satu kontak per baris</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleSimpleImport}
                disabled={importing}
                className="hidden"
                id="simple-upload"
              />
              <label htmlFor="simple-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {importing ? "Mengimport..." : "Upload CSV/TXT"}
                </p>
                <p className="text-xs text-muted-foreground">Format: CSV atau TXT</p>
              </label>
            </div>
          </TabsContent>
        </Tabs>

        {importing && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-xs text-center text-muted-foreground">
              Mengimport kontak... {progress}%
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
