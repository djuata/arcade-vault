-- Only the auth.users trigger may run it; never callable through /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
