-- Add admin RLS policies for broadcast functionality
-- This migration adds policies to allow admins to view and manage all data

-- Add admin policy for contacts table
CREATE POLICY "Admins can view all contacts"
ON public.contacts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policy for devices table
CREATE POLICY "Admins can view all devices"
ON public.devices FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policy for broadcasts table
CREATE POLICY "Admins can view all broadcasts"
ON public.broadcasts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert broadcasts"
ON public.broadcasts FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update broadcasts"
ON public.broadcasts FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policy for message_queue table (for sending messages)
CREATE POLICY "Admins can insert into message_queue"
ON public.message_queue FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all message_queue"
ON public.message_queue FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update message_queue"
ON public.message_queue FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));
