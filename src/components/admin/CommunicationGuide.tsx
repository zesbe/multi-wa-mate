import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Mail, 
  FileText, 
  Send, 
  BarChart3, 
  Code, 
  BookOpen,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const CommunicationGuide = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Panduan Communication Hub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overview */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Apa itu Communication Hub?
            </h3>
            <p className="text-sm text-muted-foreground">
              Sistem manajemen komunikasi terpusat untuk mengirim dan melacak email, 
              notifikasi, SMS, dan WhatsApp messages ke users.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Analytics</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Monitor delivery rate, open rate, dan click rate untuk semua communications
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Templates</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Buat dan kelola reusable message templates dengan dynamic variables
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Send Messages</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Kirim email, notifications, SMS via API atau edge functions
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <h4 className="font-medium">Audit Logs</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Semua aksi tercatat otomatis dengan real-time updates
              </p>
            </div>
          </div>

          {/* Quick Start */}
          <div className="border-l-4 border-primary pl-4 space-y-2">
            <h3 className="font-semibold">Quick Start</h3>
            <ol className="text-sm space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-bold text-foreground">1.</span>
                <span>Buat template di <Badge variant="outline">/admin/notification-templates</Badge></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">2.</span>
                <span>Gunakan variables seperti <code className="text-xs bg-muted px-1 rounded">{"{{user_name}}"}</code></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">3.</span>
                <span>Kirim via code dengan <code className="text-xs bg-muted px-1 rounded">logCommunication()</code></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">4.</span>
                <span>Monitor analytics di <Badge variant="outline">/admin/communication</Badge></span>
              </li>
            </ol>
          </div>

          {/* Code Example */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" />
              Contoh Kode
            </h3>
            <div className="bg-muted rounded-lg p-4">
              <pre className="text-xs overflow-x-auto">
{`import { logCommunication } from "@/utils/auditLogger";

// Send email dengan template
await logCommunication({
  recipient_email: "user@example.com",
  type: "email",
  subject: "Welcome to Platform",
  content: "Hi John, welcome aboard!",
  template_id: "template-uuid",
  status: "sent"
});`}
              </pre>
            </div>
          </div>

          {/* Available Variables */}
          <div>
            <h3 className="font-semibold mb-2">Variabel Tersedia</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{"{{user_name}}"}</Badge>
              <Badge variant="secondary">{"{{email}}"}</Badge>
              <Badge variant="secondary">{"{{plan_name}}"}</Badge>
              <Badge variant="secondary">{"{{amount}}"}</Badge>
              <Badge variant="secondary">{"{{expiry_date}}"}</Badge>
              <Badge variant="secondary">{"{{days_left}}"}</Badge>
            </div>
          </div>

          {/* Warning */}
          <div className="border-l-4 border-orange-500 pl-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <h3 className="font-semibold">Penting!</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Untuk pengiriman actual email/SMS, Anda perlu mengintegrasikan dengan 
              service provider seperti SendGrid, Twilio, atau AWS SES. 
              Saat ini sistem hanya mencatat logs untuk tracking purposes.
            </p>
          </div>

          {/* Documentation Link */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Untuk panduan lengkap, lihat file:
            </p>
            <Badge variant="outline" className="font-mono">
              COMMUNICATION_HUB_GUIDE.md
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
