import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Edit, Trash2, Plus, Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Template {
  id: string;
  name: string;
  type: string;
  subject: string;
  content: string;
  variables: string[];
  status: "active" | "draft";
  lastUsed: string;
  usageCount: number;
}

export const AdminNotificationTemplates = () => {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: "1",
      name: "Welcome Email",
      type: "email",
      subject: "Welcome to {{app_name}}!",
      content: "Hi {{user_name}},\n\nWelcome to our platform! We're excited to have you on board.\n\nBest regards,\nThe Team",
      variables: ["app_name", "user_name"],
      status: "active",
      lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      usageCount: 156
    },
    {
      id: "2",
      name: "Subscription Expiring",
      type: "email",
      subject: "Your {{plan_name}} subscription expires in {{days_left}} days",
      content: "Hi {{user_name}},\n\nYour subscription will expire soon. Renew now to continue enjoying premium features.\n\nExpires: {{expiry_date}}",
      variables: ["user_name", "plan_name", "days_left", "expiry_date"],
      status: "active",
      lastUsed: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      usageCount: 234
    },
    {
      id: "3",
      name: "Payment Failed",
      type: "notification",
      subject: "Payment Failed - Action Required",
      content: "Your payment of {{amount}} failed. Please update your payment method.",
      variables: ["amount"],
      status: "active",
      lastUsed: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 89
    },
    {
      id: "4",
      name: "New Feature Announcement",
      type: "email",
      subject: "New Feature: {{feature_name}}",
      content: "We've just launched {{feature_name}}!\n\n{{feature_description}}\n\nTry it now!",
      variables: ["feature_name", "feature_description"],
      status: "draft",
      lastUsed: "",
      usageCount: 0
    }
  ]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Mail className="w-8 h-8 text-primary" />
              Notification Templates
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Create and manage reusable message templates
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input placeholder="e.g., Welcome Email" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select defaultValue="email">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="notification">In-App Notification</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input placeholder="Email subject or notification title" />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    rows={8}
                    placeholder="Use {{variable_name}} for dynamic content"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Variables</Label>
                  <Input placeholder="Comma-separated: user_name, amount, date" />
                  <p className="text-xs text-muted-foreground">
                    Available: user_name, email, plan_name, amount, expiry_date
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setIsCreateOpen(false)}>
                    Create Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Template Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {templates.filter(t => t.status === "active").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {templates.filter(t => t.status === "draft").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.reduce((sum, t) => sum + t.usageCount, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {template.name}
                      <Badge variant={template.status === "active" ? "default" : "secondary"}>
                        {template.status}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Type: {template.type}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                  <p className="text-sm font-medium">{template.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Content Preview:</p>
                  <p className="text-xs line-clamp-2">{template.content}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {template.variables.map((variable) => (
                    <Badge key={variable} variant="outline" className="text-xs">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>Used: {template.usageCount} times</span>
                  {template.lastUsed && (
                    <span>Last: {new Date(template.lastUsed).toLocaleDateString("id-ID")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Preview Dialog */}
        {selectedTemplate && (
          <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedTemplate.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="text-sm font-medium mt-1">{selectedTemplate.subject}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Content</Label>
                  <div className="mt-1 p-4 bg-muted rounded-md">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {selectedTemplate.content}
                    </pre>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Variables</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="outline">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNotificationTemplates;
