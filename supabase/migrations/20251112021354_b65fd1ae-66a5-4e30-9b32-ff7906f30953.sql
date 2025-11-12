-- Remove insecure user INSERT policy on payments table
-- Users should not be able to create payment records directly
-- Only the pakasir-create-transaction edge function should create payments

DROP POLICY IF EXISTS "Users can create their own payments" ON public.payments;

-- Add comment explaining why this policy was removed
COMMENT ON TABLE public.payments IS 'Payment records should only be created through validated server-side flows (pakasir-create-transaction edge function with service role key). Direct user inserts are prohibited to prevent fake payment records and subscription manipulation.';
