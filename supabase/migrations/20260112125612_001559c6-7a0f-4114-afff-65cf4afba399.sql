-- Add INSERT policy for webhooks_log for defense-in-depth
-- Service role key bypasses RLS, but explicit policy documents intent
CREATE POLICY "Service role can insert webhooks"
ON public.webhooks_log FOR INSERT
WITH CHECK (true);