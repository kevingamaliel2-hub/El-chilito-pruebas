-- Concede vincular_huertos a UNA cuenta administradora. Query Tool, como chilito_pkg_owner.
-- Requisitos: el parche 06 ya aplicado y la cuenta con TOTP o llave de acceso activos.
-- Cambia solo el correo de la línea marcada. No da ninguna otra capacidad ni privilegio de PostgreSQL.
-- Al usarla, el panel pedirá además confirmar el segundo factor si no se usó en los últimos 5 minutos.
DO $$
DECLARE
 correo text := 'CAMBIA_ESTE_CORREO@example.test'; -- <== escribe aquí el correo de la cuenta
 u bigint; p integer; n integer;
BEGIN
 SELECT id INTO u FROM public.cuentas_usuario WHERE lower(email)=lower(btrim(correo)) AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'No existe una cuenta activa con ese correo'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mfa_authenticator WHERE user_id=u AND type IN ('totp','webauthn'))
 THEN RAISE EXCEPTION 'La cuenta debe activar antes la app autenticadora o una llave de acceso'; END IF;
 SELECT p2.id INTO p FROM public.auth_permission p2 JOIN public.django_content_type c ON c.id=p2.content_type_id
  WHERE c.app_label='datos' AND p2.codename='vincular_huertos';
 IF NOT FOUND THEN RAISE EXCEPTION 'Falta la capacidad: aplica antes el parche 06_vinculacion_huerto.sql'; END IF;
 INSERT INTO public.cuentas_usuario_user_permissions(usuario_id,permission_id) VALUES(u,p) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT;
 RAISE NOTICE '%', CASE WHEN n=1 THEN 'Capacidad vincular_huertos concedida.' ELSE 'La cuenta ya tenía la capacidad.' END;
END $$;
