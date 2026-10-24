GRANT SELECT ON public.user_access TO authenticated;
CREATE POLICY "OAuth users can view own access"
ON public.user_access FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

GRANT SELECT ON public.access_subscriptions TO authenticated;
CREATE POLICY "OAuth users can view own subscriptions"
ON public.access_subscriptions FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));