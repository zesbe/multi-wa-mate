import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface MessageVariablesProps {
  onInsert: (text: string) => void;
}

export const MessageVariables = ({ onInsert }: MessageVariablesProps) => {
  const variables = [
    {
      category: "Data Kontak",
      items: [
        { 
          syntax: "[[NAME]]", 
          description: "Nama WhatsApp penerima",
          example: "Halo [[NAME]]!",
          color: "bg-blue-500"
        },
        { 
          syntax: "{nama}", 
          description: "Nama kontak dari Supabase database",
          example: "Terima kasih {nama}",
          color: "bg-green-500"
        },
        { 
          syntax: "{nomor}", 
          description: "Nomor telepon penerima",
          example: "Nomor Anda: {nomor}",
          color: "bg-purple-500"
        },
      ]
    },
    {
      category: "Variabel Custom",
      items: [
        { 
          syntax: "{var1}", 
          description: "Variabel custom 1 dari Supabase (per kontak)",
          example: "Kode promo: {var1}",
          color: "bg-orange-500"
        },
        { 
          syntax: "{var2}", 
          description: "Variabel custom 2 dari Supabase (per kontak)",
          example: "Produk: {var2}",
          color: "bg-orange-500"
        },
        { 
          syntax: "{var3}", 
          description: "Variabel custom 3 dari Supabase (per kontak)",
          example: "Tanggal: {var3}",
          color: "bg-orange-500"
        },
      ]
    },
    {
      category: "Text Dinamis",
      items: [
        { 
          syntax: "(halo|hai|hi)", 
          description: "Random dari pilihan (pisah dengan |)",
          example: "(Halo|Hai|Hi) selamat (pagi|siang|sore|malam)!",
          color: "bg-pink-500"
        },
      ]
    },
    {
      category: "Waktu & Tanggal",
      items: [
        { 
          syntax: "{{waktu}}", 
          description: "Waktu saat ini (HH:mm)",
          example: "Pesan dikirim pada {{waktu}}",
          color: "bg-cyan-500"
        },
        { 
          syntax: "{{tanggal}}", 
          description: "Tanggal hari ini (DD/MM/YYYY)",
          example: "Tanggal: {{tanggal}}",
          color: "bg-cyan-500"
        },
        { 
          syntax: "{{hari}}", 
          description: "Nama hari ini",
          example: "Selamat hari {{hari}}!",
          color: "bg-cyan-500"
        },
      ]
    }
  ];

  const handleCopy = (syntax: string) => {
    navigator.clipboard.writeText(syntax);
    toast.success("Disalin ke clipboard");
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Variable Pesan Dinamis</CardTitle>
        </div>
        <CardDescription>
          Personalisasi pesan Anda dengan variable otomatis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {variables.map((category) => (
          <div key={category.category} className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">{category.category}</h4>
            </div>
            <div className="space-y-2 pl-6">
              {category.items.map((item) => (
                <div key={item.syntax} className="group space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant="secondary" 
                      className={`font-mono text-xs ${item.color} text-white hover:opacity-80 cursor-pointer`}
                      onClick={() => onInsert(item.syntax)}
                    >
                      {item.syntax}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex-1">
                      {item.description}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleCopy(item.syntax)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onInsert(item.syntax)}
                      >
                        Insert
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic pl-2">
                    Contoh: {item.example}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <div className="pt-2 border-t">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Tips Penggunaan:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Klik pada badge untuk insert ke pesan</li>
                <li>Gunakan (opsi1|opsi2) untuk text random</li>
                <li>Variable akan diganti otomatis dari data Supabase</li>
                <li>{"{nama}"}, {"{var1}"}, {"{var2}"}, {"{var3}"} diambil dari tabel contacts</li>
                <li>Kombinasikan multiple variable untuk personalisasi maksimal</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
