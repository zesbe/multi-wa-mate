import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  action: 'create' | 'update' | 'delete' | 'send';
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
}

export const logAudit = async ({
  action,
  entity_type,
  entity_id,
  old_values,
  new_values
}: AuditLogParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No user found for audit log');
      return;
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        admin_id: user.id,
        action,
        entity_type,
        entity_id,
        old_values: old_values || null,
        new_values: new_values || null
      });

    if (error) {
      console.error('Failed to create audit log:', error);
    }
  } catch (error) {
    console.error('Error in audit logger:', error);
  }
};

export const logCommunication = async ({
  recipient_email,
  recipient_phone,
  type,
  subject,
  content,
  template_id,
  status = 'sent'
}: {
  recipient_email?: string;
  recipient_phone?: string;
  type: 'email' | 'notification' | 'sms' | 'whatsapp';
  subject?: string;
  content: string;
  template_id?: string;
  status?: string;
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No user found for communication log');
      return;
    }

    const { error } = await supabase
      .from('communication_logs')
      .insert({
        user_id: user.id,
        recipient_email,
        recipient_phone,
        type,
        subject,
        content,
        template_id,
        status,
        sent_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to create communication log:', error);
    }
  } catch (error) {
    console.error('Error in communication logger:', error);
  }
};
