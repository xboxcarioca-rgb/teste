-- Restrict audit_logs INSERT to service_role only (was authenticated with own user_id)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Add explicit service_role INSERT policy for security_logs
DROP POLICY IF EXISTS "Service role can insert security logs" ON public.security_logs;
CREATE POLICY "Service role can insert security logs"
ON public.security_logs
FOR INSERT
TO service_role
WITH CHECK (true);