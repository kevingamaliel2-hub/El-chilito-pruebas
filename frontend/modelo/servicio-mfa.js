// Segundo factor. La criptografía y las reglas viven en allauth; aquí solo se transporta.
const MfaService = (() => {
  const p = '/_allauth/browser/v1/';
  const a = p+'account/authenticators';
  function outcome(r) {
    if(r.http === 429 || r.body?.errors?.some(e => e.code === 'too_many_login_attempts')) return {status:'limited'};
    if(r.http === 401 && r.body?.data?.flows?.some(f => ['reauthenticate','mfa_reauthenticate'].includes(f.id))) return {status:'reauthentication-required'};
    if(r.http === 401 && r.body?.meta?.is_authenticated === false && !r.body?.data?.flows?.some(f => f.is_pending)) return {status:'unauthenticated'};
    if(r.http === 400) return {status:'invalid'};
    if(r.http === 409) return {status:'conflict'};
    if(r.http === 404) return {status:'not-found',meta:r.body?.meta};
    if(r.http === 200 || r.http === 401) return {status:'ok',data:r.body?.data,meta:r.body?.meta};
    return {status:'unavailable'};
  }
  async function call(path, method = 'GET', body) {
    try { return outcome(await ChilitoHTTP.request(path, {method, ...(body ? {body} : {})})); }
    catch { return {status:'unavailable'}; }
  }
  const pendingStep = data => data?.flows?.find(flow => flow.is_pending === true && ['login_by_code','mfa_authenticate'].includes(flow.id));
  // Con un correo, abre el mensaje ya redactado. Nunca pide contraseñas ni códigos.
  function supportContact(contact) {
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return {text:'Contacto: '+contact};
    const body = 'Perdí el acceso a mi cuenta de El Chilito.\n\nCorreo de mi cuenta:\nQué perdí (app, llave, códigos):\nFecha aproximada en que me registré:\n\nNo incluyas tu contraseña ni códigos.';
    return {text:'Escribir a soporte: '+contact, href:'mailto:'+contact+'?subject='+encodeURIComponent('Recuperar acceso a El Chilito')+'&body='+encodeURIComponent(body)};
  }
  return Object.freeze({
    supportContact,
    async pending() {
      const result = await call(p+'auth/session');
      const flow = pendingStep(result.data);
      return flow ? {kind:flow.id,types:flow.types || []} : null;
    },
    finished: result => result.status === 'ok' && result.meta?.is_authenticated === true,
    confirmCode: code => call(p+'auth/code/confirm','POST',{code}),
    authenticate: code => call(p+'auth/2fa/authenticate','POST',{code}),
    webauthnRequest: () => call(p+'auth/webauthn/authenticate'),
    webauthnAuthenticate: credential => call(p+'auth/webauthn/authenticate','POST',{credential}),
    list: () => call(a),
    reauthenticate: password => call(p+'auth/reauthenticate','POST',{password}),
    // Confirmación del segundo factor para operaciones sensibles del panel (TOTP o llave de acceso).
    reauthenticateCode: code => call(p+'auth/2fa/reauthenticate','POST',{code}),
    webauthnReauthOptions: () => call(p+'auth/webauthn/reauthenticate'),
    webauthnReauthenticate: credential => call(p+'auth/webauthn/reauthenticate','POST',{credential}),
    totpStart: () => call(a+'/totp'),
    async totpImage() {
      try { const r = await ChilitoHTTP.request('/api/cuenta/seguridad/totp-qr'); return r.http === 200 ? r.body.image : null; }
      catch { return null; }
    },
    totpActivate: code => call(a+'/totp','POST',{code}),
    totpDisable: () => call(a+'/totp','DELETE',{}),
    recoveryView: () => call(a+'/recovery-codes'),
    recoveryRegenerate: () => call(a+'/recovery-codes','POST',{}),
    webauthnOptions: () => call(a+'/webauthn'),
    webauthnAdd: (name,credential) => call(a+'/webauthn','POST',{name,credential}),
    webauthnRemove: ids => call(a+'/webauthn','DELETE',{authenticators:ids})
  });
})();
