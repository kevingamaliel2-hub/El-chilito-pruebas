// allauth decide; aquí solo se pide lo que falta y se muestra el resultado.
const WebAuthnBrowser = Object.freeze({
  supported: () => Boolean(window.PublicKeyCredential?.parseCreationOptionsFromJSON),
  async create(options) {
    const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(options.publicKey);
    return (await navigator.credentials.create({publicKey})).toJSON();
  },
  async get(options) {
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(options.publicKey);
    return (await navigator.credentials.get({publicKey})).toJSON();
  }
});

const SecondStepController = (() => {
  const texts = {invalid:'El código no es válido.',limited:'Demasiados intentos. Espera un momento.',conflict:'El proceso venció. Inicia sesión de nuevo.',unavailable:'No se pudo comprobar. Inténtalo de nuevo.'};
  function mount({root, assets = '', onDone, onCancel, service = MfaService}) {
    let alive = true;
    root.innerHTML = AuthViews.layout('Confirma tu acceso','Falta un paso para entrar.','<div data-step-host role="status">Comprobando…</div>',assets);
    const host = root.querySelector('[data-step-host]');
    (async () => {
      const step = await service.pending();
      if(!alive) return;
      if(!step) { onCancel(); return; }
      host.removeAttribute('role');
      host.innerHTML = MfaViews.step(step.kind);
      const form = host.querySelector('[data-step]');
      const feedback = host.querySelector('[data-step-feedback]');
      const fail = status => { feedback.textContent = texts[status] || texts.unavailable; feedback.hidden = false; if(['conflict','unauthenticated'].includes(status)) onCancel(); };
      const finish = result => { service.finished(result) ? onDone() : fail(result.status === 'ok' ? 'unavailable' : result.status); };
      const key = host.querySelector('[data-step-key]');
      key.hidden = !(step.types.includes('webauthn') && WebAuthnBrowser.supported());
      const submit = form.querySelector('[type=submit]');
      form.addEventListener('submit',async event => {
        event.preventDefault();
        const code = form.elements.code.value.trim();
        if(!code || submit.disabled) return;
        submit.disabled = true;
        submit.textContent = 'Comprobando…';
        const result = await (step.kind === 'login_by_code' ? service.confirmCode(code) : service.authenticate(code));
        if(!alive) return;
        submit.disabled = false;
        submit.textContent = 'Continuar';
        finish(result);
      });
      key.addEventListener('click',async () => {
        const options = await service.webauthnRequest();
        if(options.status !== 'ok') { fail(options.status); return; }
        try { finish(await service.webauthnAuthenticate(await WebAuthnBrowser.get(options.data.request_options))); }
        catch { fail('unavailable'); }
      });
      host.querySelector('[data-step-cancel]').addEventListener('click',async () => { await AuthService.logout(); onCancel(); });
    })();
    return {dispose() { alive = false; }};
  }
  return {mount};
})();

const MfaController = (() => {
  function mount({root, service = MfaService}) {
    const life = new AbortController();
    root.innerHTML = MfaViews.account();
    const q = selector => root.querySelector(selector);
    const on = (node, type, fn) => node.addEventListener(type,fn,{signal:life.signal});
    let retry = null;
    function say(text, failed = false) {
      const box = q('#mfa-feedback');
      box.hidden = false; box.textContent = text; box.setAttribute('role',failed?'alert':'status'); box.focus();
    }
    async function guarded(action, done) {
      const result = await action();
      if(life.signal.aborted) return;
      if(result.status === 'reauthentication-required') {
        retry = () => guarded(action,done);
        q('[data-mfa-reauth]').hidden = false;
        q('[data-reauth] input').focus();
        return;
      }
      if(result.status === 'ok' || result.status === 'not-found') await done(result);
      else say(result.status === 'invalid' ? 'Revisa el dato e inténtalo de nuevo.' : result.status === 'limited' ? 'Demasiados intentos. Espera un momento.' : 'No se pudo completar la operación.',true);
    }
    function showCodes(codes) {
      q('[data-recovery-list]').replaceChildren(...codes.map(code => Object.assign(document.createElement('li'),{textContent:code})));
      q('[data-recovery-new]').hidden = false;
      q('[data-recovery-new]').scrollIntoView({block:'nearest'});
    }
    async function load() {
      const result = await service.list();
      if(life.signal.aborted) return;
      if(result.status === 'unauthenticated') { ChilitoHTTP.sessionExpired(); return; }
      if(result.status !== 'ok') { say('No se pudieron consultar tus métodos.',true); return; }
      const items = result.data || [];
      const totp = items.find(item => item.type === 'totp');
      const keys = items.filter(item => item.type === 'webauthn');
      const recovery = items.find(item => item.type === 'recovery_codes');
      const strong = Boolean(totp || keys.length);
      q('[data-mfa-required]').hidden = !(AuthService.session?.profile?.mfaRequired === true && !strong);
      q('[data-mail-state]').textContent = strong ? 'Inactivo: ya confirmas tu acceso con un método más fuerte.' : 'Activo: te enviamos un código cada vez que entras con tu contraseña.';
      q('[data-totp-state]').textContent = totp ? 'Activa.' : 'Sin activar.';
      q('[data-mfa="totp-start"]').hidden = Boolean(totp);
      q('[data-mfa="totp-disable"]').hidden = !totp;
      q('[data-totp-form]').hidden = true;
      q('[data-keys]').replaceChildren(...keys.map(MfaViews.methodItem));
      q('[data-recovery-state]').textContent = recovery ? `Te quedan ${recovery.unused_code_count} de ${recovery.total_code_count}.` : 'Se generan al activar tu primer método.';
      q('[data-mfa="recovery-regenerate"]').hidden = !recovery;
    }
    on(root,'click',event => {
      const remove = event.target.closest('[data-key-remove]');
      if(remove) guarded(() => service.webauthnRemove([Number(remove.dataset.keyRemove)]),async () => { say('Llave quitada.'); load(); });
      const action = event.target.closest('[data-mfa]')?.dataset.mfa;
      if(action === 'totp-start') guarded(service.totpStart,async result => {
        q('[data-totp-secret]').textContent = result.meta?.secret || '';
        q('[data-totp-image]').src = await service.totpImage() || '';
        q('[data-totp-form]').hidden = false;
      });
      if(action === 'totp-disable') guarded(service.totpDisable,async () => { say('App autenticadora desactivada.'); load(); });
      if(action === 'recovery-regenerate') guarded(service.recoveryRegenerate,async result => { showCodes(result.data?.unused_codes || []); load(); });
    });
    on(q('[data-reauth]'),'submit',async event => {
      event.preventDefault();
      const result = await service.reauthenticate(event.target.elements.password.value);
      event.target.reset();
      if(result.status !== 'ok') { say('Contraseña incorrecta.',true); return; }
      q('[data-mfa-reauth]').hidden = true;
      const next = retry; retry = null; next?.();
    });
    on(q('[data-totp-form]'),'submit',event => {
      event.preventDefault();
      const code = event.target.elements.code.value.trim();
      guarded(() => service.totpActivate(code),async () => {
        say('App autenticadora activada.');
        event.target.reset();
        await AuthService.restore();
        await load();
        const codes = await service.recoveryView();
        if(codes.status === 'ok' && codes.data?.unused_codes?.length) showCodes(codes.data.unused_codes);
      });
    });
    on(q('[data-key-form]'),'submit',event => {
      event.preventDefault();
      const name = event.target.elements.name.value.trim();
      if(!WebAuthnBrowser.supported()) { say('Este navegador no admite llaves de acceso.',true); return; }
      guarded(service.webauthnOptions,async options => {
        let credential;
        try { credential = await WebAuthnBrowser.create(options.data.creation_options); }
        catch { say('No se creó la llave.',true); return; }
        const added = await service.webauthnAdd(name,credential);
        if(added.status !== 'ok') { say('No se pudo guardar la llave.',true); return; }
        say('Llave agregada.');
        event.target.reset();
        await AuthService.restore();
        await load();
        if(added.meta?.recovery_codes_generated) { const codes = await service.recoveryView(); if(codes.status === 'ok' && codes.data?.unused_codes?.length) showCodes(codes.data.unused_codes); }
      });
    });
    load();
    return {dispose() { life.abort(); }};
  }
  return {mount};
})();
