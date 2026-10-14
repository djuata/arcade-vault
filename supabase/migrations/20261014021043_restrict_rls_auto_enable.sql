-- rls_auto_enable() backs the dashboard's ensure_rls event trigger (auto-enables
-- RLS on new public tables). It is SECURITY DEFINER and was exposed via
-- /rest/v1/rpc to anon/authenticated (advisors 0028/0029). Event triggers do
-- not need these grants, so revoke them (spec 21).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
