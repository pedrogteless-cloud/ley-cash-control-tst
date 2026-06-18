-- Trigger-only functions: revoke from PUBLIC/anon/authenticated.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_telegram() FROM PUBLIC, anon, authenticated;

-- has_role is used by RLS policies; only authenticated needs to call it.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- App RPCs: only authenticated should execute (functions perform their own role checks).
REVOKE ALL ON FUNCTION public.enviar_cheque_nfs(uuid[], text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_cheque_nfs(uuid[], text, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.confirmar_envio_nf(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_envio_nf(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.separar_nf(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.separar_nf(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancelar_separacao_nf(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_separacao_nf(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_devolvido(uuid, text, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_devolvido(uuid, text, numeric, numeric, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.send_status_telegram(numeric, integer, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_status_telegram(numeric, integer, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';