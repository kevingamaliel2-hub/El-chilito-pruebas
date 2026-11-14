// Vinculación de huertos: eventos y coordinación. El servidor confirma; aquí nunca se supone un éxito.
const BindingUserController = (() => {
  const texts = {
    format:'Revisa el código: son 26 letras y números. Puedes pegarlo con o sin guiones.',
    rejected:'El código no es válido o ya venció. Pide uno nuevo al equipo.',
    limited:'Demasiados intentos. Pide un código nuevo al equipo; si lo intentaste muchas veces, espera una hora.',
    busy:'Demasiadas solicitudes seguidas. Espera un momento y vuelve a intentarlo.',
    network:'No pudimos comunicarnos con el servidor. Vuelve a intentarlo: si ya se vinculó, lo reconoceremos.'};
  // Escucha en la raíz de la pantalla: el formulario se vuelve a dibujar con cada carga.
  function attach({root, signal, service = BindingService, onLinked}) {
    let busy = false;
    root.addEventListener('submit', async event => {
      const form = event.target.closest('[data-binding-form]');
      if(!form) return;
      event.preventDefault();
      if(busy) return;
      const raw = form.elements.code.value;
      if(!service.normalize(raw)) { BindingViews.userStatus(form, texts.format, {error:true}); return; }
      busy = true;
      BindingViews.userStatus(form, 'Validando el código…', {busy:true});
      const result = await service.consume(raw);
      busy = false;
      if(signal.aborted) return;
      if(result.status === 'linked' || result.status === 'already-linked') { onLinked(result); return; }
      BindingViews.userStatus(form, texts[result.status] || 'No se pudo completar la vinculación. Inténtalo de nuevo.', {error:true});
    }, {signal});
    BindingHelpController.attach({root, signal});
  }
  return Object.freeze({attach});
})();

const BindingAdminController = (() => {
  const messages = {forbidden:'Tu cuenta no tiene la capacidad para vincular huertos.', stale:'Ese código ya estaba cerrado. Se actualizó la lista.',
    busy:'Demasiadas operaciones seguidas. Espera un momento.', invalid:'Revisa los datos del formulario.',
    network:'No se pudo comunicar con el servidor. Inténtalo de nuevo.'};
  function mount({root, service = BindingService, mfa = MfaService} = {}) {
    const life = new AbortController();
    root.innerHTML = BindingViews.adminShell();
    const form = root.querySelector('[data-binding-issue]'), reveal = root.querySelector('[data-binding-reveal]');
    const feedback = root.querySelector('#admin-feedback'), dialog = root.querySelector('.binding-reauth');
    const totpForm = dialog.querySelector('[data-binding-totp]'), reauthStatus = dialog.querySelector('[data-reauth-status]');
    let busy = false, waiting = null;
    function say(text, error = false) {
      feedback.hidden = !text; feedback.textContent = text;
      feedback.setAttribute('role', error ? 'alert' : 'status');
      if(text) feedback.focus();
    }
    async function load() {
      const result = await service.panel();
      if(life.signal.aborted) return;
      if(result.status !== 'ready') { say(messages[result.status] || 'No se pudo consultar la vinculación.', true); return; }
      BindingViews.gardenOptions(form.elements.garden, result.gardens);
      root.querySelector('[data-binding-pending]').replaceChildren(BindingViews.table(result.pending, service, true));
      root.querySelector('[data-binding-recent]').replaceChildren(BindingViews.table(result.recent, service, false));
    }
    // Una operación sensible: si falta la confirmación reciente del segundo factor, se pide y se repite.
    async function sensitive(action, done) {
      const result = await action();
      if(life.signal.aborted) return;
      if(result.status === 'reauthenticate') {
        waiting = {action, done};
        reauthStatus.hidden = true; totpForm.reset();
        dialog.showModal(); totpForm.elements.code.focus();
        return;
      }
      await done(result);
    }
    async function confirmed(outcome) {
      if(outcome.status !== 'ok') {
        reauthStatus.hidden = false;
        reauthStatus.textContent = outcome.status === 'limited' ? 'Demasiados intentos. Espera un momento.' : 'No se pudo confirmar. Revisa el código o inténtalo con tu llave.';
        reauthStatus.focus();
        return;
      }
      dialog.close();
      const next = waiting; waiting = null;
      if(next) await sensitive(next.action, next.done);
    }
    async function issued(result) {
      busy = false; form.querySelector('[type=submit]').disabled = false;
      if(result.status === 'issued') {
        BindingViews.reveal(reveal, result, service);
        say(result.code ? 'Código emitido. Díctalo o cópialo ahora: no se volverá a mostrar.' : 'Código emitido para envío por correo.');
        form.elements.email.value = '';
        await load();
        // El código queda bajo el formulario: se lleva el foco ahí para que se vea y se lea.
        const title = reveal.querySelector('h3');
        if(title) { title.tabIndex = -1; title.focus(); title.scrollIntoView({block:'center'}); }
        return;
      }
      if(result.status === 'refused') { say(service.refusals[result.reason] || 'No se puede emitir el código.', true); return; }
      say(messages[result.status] || 'No se pudo emitir el código.', true);
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if(busy) return;
      const garden = form.elements.garden.value, email = form.elements.email.value.trim(), delivery = form.elements.delivery.value;
      if(!garden || !email) { say('Elige un huerto y escribe el correo de la cuenta.', true); return; }
      busy = true; form.querySelector('[type=submit]').disabled = true;
      reveal.hidden = true; reveal.replaceChildren();
      await sensitive(() => service.issue(garden, email, delivery), issued);
      if(waiting) { busy = false; form.querySelector('[type=submit]').disabled = false; }
    }, {signal:life.signal});
    root.addEventListener('click', async event => {
      const copy = event.target.closest('[data-binding-copy]');
      if(copy) {
        const text = root.querySelector('#binding-code-value')?.textContent || '';
        try { await navigator.clipboard.writeText(text); say('Código copiado.'); }
        catch { say('No se pudo copiar. Selecciona el código y cópialo a mano.', true); }
        return;
      }
      const revoke = event.target.closest('[data-binding-revoke]');
      if(revoke && !busy) {
        busy = true; revoke.disabled = true;
        await sensitive(() => service.revoke(revoke.dataset.bindingRevoke), async result => {
          say(result.status === 'revoked' ? 'Código revocado.' : (messages[result.status] || 'No se pudo revocar.'), result.status !== 'revoked');
          await load();
        });
        busy = false; if(revoke.isConnected) revoke.disabled = false;
      }
    }, {signal:life.signal});
    totpForm.addEventListener('submit', async event => {
      event.preventDefault();
      const code = totpForm.elements.code.value.trim();
      if(!/^[0-9]{6}$/.test(code)) { reauthStatus.hidden = false; reauthStatus.textContent = 'Escribe los 6 dígitos de tu app autenticadora.'; reauthStatus.focus(); return; }
      await confirmed(await mfa.reauthenticateCode(code));
    }, {signal:life.signal});
    dialog.querySelector('[data-binding-passkey]').addEventListener('click', async () => {
      if(!WebAuthnBrowser.supported()) { await confirmed({status:'unsupported'}); return; }
      const options = await mfa.webauthnReauthOptions();
      if(options.status !== 'ok' || !options.data?.request_options) { await confirmed({status:'unavailable'}); return; }
      try { await confirmed(await mfa.webauthnReauthenticate(await WebAuthnBrowser.get(options.data.request_options))); }
      catch { await confirmed({status:'cancelled'}); }
    }, {signal:life.signal});
    const cancel = () => { waiting = null; if(dialog.open) dialog.close(); say('Operación cancelada: no se emitió ni revocó nada.'); };
    dialog.querySelector('[data-binding-cancel]').addEventListener('click', cancel, {signal:life.signal});
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); }, {signal:life.signal});
    load();
    return {dispose() { life.abort(); if(dialog.open) dialog.close(); }};
  }
  return Object.freeze({mount});
})();

// Ayuda para vincular: prepara un correo que la persona revisa y envía. Abrir el enlace no significa que se envió.
const BindingHelpController = (() => {
  const texts = {
    'need-reason':'Elige un motivo para preparar el correo.',
    'need-detail':'Explica el motivo para preparar el correo.',
    'too-long':'Acorta tu explicación: puedes añadir más detalles en el correo.',
    secret:'Quita cualquier código de tu explicación. No hace falta para ayudarte.',
    unavailable:'El contacto de soporte no está disponible por ahora. Inténtalo más tarde.',
    copied:'Mensaje copiado',
    blocked:'Tu navegador no permitió copiar. Selecciona el texto preparado y cópialo a mano.',
    prepared:'Pedimos a tu navegador que abra tu aplicación de correo con el mensaje listo. Revísalo y envíalo desde ahí: todavía no se ha enviado nada.'};
  const writeClipboard = async text => {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };
  async function copyAddress(panel, service) {
    if(await writeClipboard(service.contact() || '')) BindingViews.helpStatus(panel, 'Dirección de soporte copiada.');
    else BindingViews.helpStatus(panel, 'No se pudo copiar. Selecciona la dirección y cópiala a mano.', {error:true});
  }
  // Único punto de lectura y validación: ambos botones parten del formulario tal como está ahora.
  function currentDraft(form, panel, service) {
    BindingViews.helpManual(panel, '');
    const result = service.draft(form.elements.reason.value, form.elements.detail.value);
    BindingViews.helpInvalid(form, result.status === 'need-detail' || result.status === 'too-long' || result.status === 'secret');
    if(result.status === 'ready') return result;
    BindingViews.helpStatus(panel, texts[result.status], {error:true});
    return null;
  }
  function attach({root, signal, service = BindingHelp}) {
    let revision = 0;
    async function copyMessage(form, panel) {
      const draft = currentDraft(form, panel, service);
      if(!draft) return;
      const started = revision;
      const copied = await writeClipboard(draft.text);
      // Si el formulario cambió mientras tanto, este resultado ya no describe lo que se ve.
      if(signal.aborted || started !== revision) return;
      if(copied) { BindingViews.helpStatus(panel, texts.copied); return; }
      BindingViews.helpStatus(panel, texts.blocked, {error:true, focus:false});
      BindingViews.helpManual(panel, draft.text);
    }
    // «toggle» no burbujea: se captura en la raíz porque el panel se vuelve a dibujar con cada carga.
    root.addEventListener('toggle', event => {
      if(event.target.matches?.('[data-binding-help]') && event.target.open) BindingViews.helpSetup(event.target, service.contact(), texts.unavailable);
    }, {signal, capture:true});
    root.addEventListener('change', event => {
      if(event.target.matches('[data-binding-help-form] [name=reason]')) BindingViews.helpDetail(event.target.form, event.target.value === 'other');
    }, {signal});
    // Cambiar el motivo o la explicación invalida cualquier resultado y texto manual anteriores.
    root.addEventListener('input', event => {
      if(!event.target.matches('[data-binding-help-form] :is([name=reason],[name=detail])')) return;
      revision += 1;
      const panel = event.target.closest('[data-binding-help]');
      BindingViews.helpManual(panel, '');
      BindingViews.helpStatus(panel, '');
    }, {signal});
    root.addEventListener('submit', event => {
      const form = event.target.closest('[data-binding-help-form]');
      if(!form) return;
      event.preventDefault();
      const panel = form.closest('[data-binding-help]');
      const draft = currentDraft(form, panel, service);
      if(!draft) return;
      BindingViews.openMail(draft.href);
      BindingViews.helpStatus(panel, texts.prepared);
    }, {signal});
    root.addEventListener('click', event => {
      const panel = event.target.closest('[data-binding-help]');
      if(!panel) return;
      if(event.target.closest('[data-binding-help-copy]')) copyAddress(panel, service);
      if(event.target.closest('[data-binding-help-copy-message]')) copyMessage(panel.querySelector('[data-binding-help-form]'), panel);
    }, {signal});
  }
  return Object.freeze({attach});
})();
