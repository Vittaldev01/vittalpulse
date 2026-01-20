-- Drop the overly permissive INSERT policy on contact_responses
DROP POLICY IF EXISTS "Users can insert responses" ON public.contact_responses;

-- Create a more restrictive policy that validates contact belongs to user's company or user's contact lists
-- This ensures users can only insert responses for contacts they have access to
CREATE POLICY "Users can insert company responses" ON public.contact_responses 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contacts c
    JOIN contact_lists cl ON c.list_id = cl.id
    WHERE c.id = contact_responses.contact_id
    AND (
      cl.user_id = auth.uid() 
      OR cl.empresa_id = get_user_empresa_id(auth.uid())
    )
  )
);