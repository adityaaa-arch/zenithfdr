CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.user_id = _user_id AND p.active = true
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

DROP POLICY IF EXISTS "authenticated full access to fdrs" ON public.fdrs;
CREATE POLICY "staff full access to fdrs" ON public.fdrs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated full access to releases" ON public.releases;
CREATE POLICY "staff full access to releases" ON public.releases FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated full access to renewals" ON public.renewals;
CREATE POLICY "staff full access to renewals" ON public.renewals FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated full access to notices" ON public.notices;
CREATE POLICY "staff full access to notices" ON public.notices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated full access to audit_log" ON public.audit_log;
CREATE POLICY "staff read audit_log" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff append audit_log" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated read settings" ON public.app_settings;
DROP POLICY IF EXISTS "authenticated update settings" ON public.app_settings;
CREATE POLICY "staff read settings" ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "approver update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'approver')) WITH CHECK (public.has_role(auth.uid(), 'approver'));

DROP POLICY IF EXISTS "authenticated read profiles" ON public.profiles;
CREATE POLICY "self or staff read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated read user_roles" ON public.user_roles;
CREATE POLICY "self or staff read user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));