-- Create broadcast_templates table for admin
CREATE TABLE IF NOT EXISTS public.broadcast_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  message_template TEXT NOT NULL,
  description TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admin can view all templates"
ON public.broadcast_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admin can create templates"
ON public.broadcast_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admin can update templates"
ON public.broadcast_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admin can delete templates"
ON public.broadcast_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_broadcast_templates_updated_at
BEFORE UPDATE ON public.broadcast_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.broadcast_templates (name, category, message_template, description, variables) VALUES
('Subscription Expiring', 'subscription', 'Hi {{name}}, your subscription will expire in {{days}} days. Please renew to continue using our service. Reply YES to renew now.', 'Notify users about upcoming subscription expiry', '["name", "days"]'::jsonb),
('Payment Reminder', 'payment', 'Hi {{name}}, you have a pending payment of {{amount}}. Please complete your payment to avoid service interruption.', 'Reminder for pending payments', '["name", "amount"]'::jsonb),
('Welcome Message', 'onboarding', 'Welcome to HalloWa, {{name}}! 🎉 We are excited to have you. Need help getting started? Reply HELP for assistance.', 'Welcome new users', '["name"]'::jsonb),
('Plan Upgrade Offer', 'marketing', 'Hi {{name}}! Upgrade to our Premium plan and get {{discount}}% off for the first month. Limited time offer! Reply UPGRADE to learn more.', 'Promote plan upgrades', '["name", "discount"]'::jsonb),
('Service Announcement', 'general', 'Important Announcement: {{announcement}}. Thank you for your attention.', 'General service announcements', '["announcement"]'::jsonb);