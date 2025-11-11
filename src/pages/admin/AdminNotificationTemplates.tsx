import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Edit, Trash2, Plus, Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/utils/auditLogger";
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

export const AdminNotificationTemplates = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'email',
    subject: '',
    content: '',
    variables: ''
  });
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newTemplate: any) => {
      const { data, error } = await supabase
        .from('notification_templates')
        .insert([{
          name: newTemplate.name,
          type: newTemplate.type,
          subject: newTemplate.subject,
          content: newTemplate.content,
          variables: newTemplate.variables.split(',').map((v: string) => v.trim()).filter(Boolean),
          status: 'active'
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Log audit
      await logAudit({
        action: 'create',
        entity_type: 'notification_template',
        entity_id: data?.id,
        new_values: {
          name: newTemplate.name,
          type: newTemplate.type,
          subject: newTemplate.subject
        }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Template created successfully');
      setIsCreateOpen(false);
      setFormData({ name: '', type: 'email', subject: '', content: '', variables: '' });
    },
    onError: () => {
      toast.error('Failed to create template');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, template }: { id: string; template: any }) => {
      // Log audit before delete
      await logAudit({
        action: 'delete',
        entity_type: 'notification_template',
        entity_id: id,
        old_values: {
          name: template.name,
          type: template.type,
          usage_count: template.usage_count
        }
      });
      
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete template');
    }
  });

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleDelete = (template: any) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteMutation.mutate({ id: template.id, template });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </AdminLayout>
    );
  }

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
                  <Input 
                    placeholder="e.g., Welcome Email" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="notification">In-App Notification</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input 
                    placeholder="Email subject or notification title" 
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    rows={8}
                    placeholder="Use {{variable_name}} for dynamic content"
                    className="font-mono text-sm"
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Variables</Label>
                  <Input 
                    placeholder="Comma-separated: user_name, amount, date" 
                    value={formData.variables}
                    onChange={(e) => setFormData({...formData, variables: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: user_name, email, plan_name, amount, expiry_date
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Template'}
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
              <div className="text-2xl font-bold">{templates?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {templates?.filter(t => t.status === "active").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {templates?.filter(t => t.status === "draft").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates?.reduce((sum, t) => sum + (t.usage_count || 0), 0) || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates && templates.length > 0 ? templates.map((template) => (
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
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={() => handleDelete(template)}
                      disabled={deleteMutation.isPending}
                    >
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
                  {template.variables && template.variables.length > 0 ? template.variables.map((variable: string) => (
                    <Badge key={variable} variant="outline" className="text-xs">
                      {`{{${variable}}}`}
                    </Badge>
                  )) : (
                    <span className="text-xs text-muted-foreground">No variables</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>Used: {template.usage_count || 0} times</span>
                  {template.last_used_at && (
                    <span>Last: {new Date(template.last_used_at).toLocaleDateString("id-ID")}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="col-span-2 text-center py-8">
              <p className="text-muted-foreground">No templates yet. Create your first template!</p>
            </div>
          )}
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
                    {selectedTemplate.variables && selectedTemplate.variables.length > 0 ? selectedTemplate.variables.map((variable: string) => (
                      <Badge key={variable} variant="outline">
                        {`{{${variable}}}`}
                      </Badge>
                    )) : (
                      <span className="text-xs text-muted-foreground">No variables</span>
                    )}
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
