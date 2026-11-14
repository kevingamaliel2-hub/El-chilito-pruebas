const authEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const AuthViews = (() => {
  const titles = {
    acceso: ['Inicia sesión', 'Entra a tu espacio para consultar el huerto.'],
    registro: ['Crea tu cuenta', 'Usa tu correo electrónico y elige una contraseña.'],
    verificar: ['Verifica tu correo', 'Escribe el código que recibiste por correo. Puedes pegarlo completo.'],
    recuperar: ['Recupera el acceso', 'Te enviaremos un enlace para elegir una contraseña nueva.'],
    restablecer: ['Elige una contraseña nueva', 'Confirma tu nueva contraseña para recuperar el acceso.'],
    cambiar: ['Cambiar contraseña', 'Confirma tu contraseña actual y elige una nueva.']
  };
  const email = value => `<div class="field"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" value="${authEscape(value)}" placeholder="tu@correo.com" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="254" required aria-describedby="email-error"><span class="field-error" id="email-error" hidden></span></div>`;
  const password = (id, label, autocomplete, descriptions = '', help = '') => `<div class="field"><label for="${id}">${label}</label><div class="password-input-group"><input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" autocapitalize="none" spellcheck="false" class="password-field-input" required aria-describedby="${id}-error${descriptions ? ' ' + descriptions : ''}"><button type="button" class="password-eye-btn no-glass" data-password-toggle="${id}" aria-controls="${id}" aria-label="Mostrar ${id === 'confirmation' ? 'confirmación de contraseña' : label.toLowerCase()}" aria-pressed="false">${iconEye}</button></div><span class="field-error" id="${id}-error" hidden></span>${help}</div>`;
  const feedback = () => '<div id="auth-feedback" class="auth-feedback" role="status" aria-live="polite" aria-atomic="true" tabindex="-1" hidden></div><p class="sr-only" id="access-errors" role="alert" aria-atomic="true"></p><p id="auth-wait" class="auth-help" aria-live="off" hidden></p>';
  const links = screen => screen === 'acceso'
    ? '<p class="auth-switch">¿Aún no tienes cuenta? <a href="#registro">Crear cuenta</a></p>'
    : screen === 'cambiar' ? '<p class="auth-switch"><a href="#cuenta">Cancelar y regresar a Mi cuenta</a></p>' : '<p class="auth-switch"><a href="#acceso">Iniciar sesión</a></p>';
  function form(screen, config, context, review = false) {
    // El mínimo es obligatorio; lo demás orienta. El servidor decide al guardar.
    const check = id => `<p id="${id}" class="password-check"><span data-password-check-icon aria-hidden="true"></span><span data-password-check-text></span></p>`;
    const requirementBlock = '<p id="password-requirements" class="auth-help">Son recomendaciones. Al guardar se rechazan contraseñas comunes, solo numéricas o parecidas a tu correo.</p>';
    const guidance = `<div class="password-guidance"><div class="password-length"><span class="password-meter" aria-hidden="true"><span data-password-meter></span></span><p id="password-counter" class="password-counter" aria-live="off"></p></div>${check('password-minimum')}<p class="password-tips-title">Para que sea más segura</p><div class="password-tips">${check('password-tip-cases')}${check('password-tip-number')}${check('password-tip-symbol')}${check('password-tip-email')}</div></div>`;
    const newPassword = label => password('password', label, 'new-password', 'password-counter password-minimum password-requirements', guidance + requirementBlock);
    const confirmation = () => password('confirmation', 'Confirmar contraseña', 'new-password', 'confirmation-match', '<p id="confirmation-match" class="password-check"><span data-password-check-icon aria-hidden="true"></span><span data-password-check-text></span></p>');
    let fields = '';
    let label = '';
    if (screen === 'acceso') {
      fields = email(context.email) + password('password', 'Contraseña', 'current-password') + '<a class="auth-text-link auth-forgot" href="#recuperar">¿Olvidaste tu contraseña?</a>';
      label = 'Iniciar sesión';
    } else if (screen === 'registro') {
      fields = email(context.email) + newPassword('Contraseña') + confirmation();
      fields += `<div class="terms-field">
        <label class="terms-label" for="termsAccepted"><input id="termsAccepted" name="termsAccepted" type="checkbox" required aria-describedby="termsAccepted-error terms-required"><span>Acepto los Términos y condiciones de El Chilito</span></label>
        <span class="terms-required" id="terms-required">Obligatorio</span>
        <span class="field-error" id="termsAccepted-error" hidden></span>
        <p><a href="#terminos" target="_blank" rel="noopener">Leer Términos y condiciones<span class="sr-only"> (se abre en otra pestaña)</span></a></p>
        <label class="terms-label terms-second" for="privacyRead"><input id="privacyRead" name="privacyRead" type="checkbox" required aria-describedby="privacyRead-error privacy-required"><span>He leído el Aviso de privacidad</span></label>
        <span class="terms-required" id="privacy-required">Obligatorio</span>
        <span class="field-error" id="privacyRead-error" hidden></span>
        <p><a href="#privacidad" target="_blank" rel="noopener">Leer Aviso de privacidad<span class="sr-only"> (se abre en otra pestaña)</span></a></p>
      </div>`;
      label = 'Crear cuenta';
    } else if (screen === 'verificar') {
      fields = email(context.email).replace('type="email"', 'type="email" readonly') + `<div class="field"><label for="code">Código de verificación</label><input id="code" name="code" class="verification-code" type="text" autocomplete="one-time-code" inputmode="${authEscape(config.code.inputMode)}" autocapitalize="none" spellcheck="false"${config.code.length ? ` maxlength="${Number(config.code.length)}"` : ''} required aria-describedby="code-error code-expiry"><span class="field-error" id="code-error" hidden></span><span class="auth-help" id="code-expiry" aria-live="off" hidden></span></div>`;
      fields += '<p class="auth-help">Ingresa el código de verificación de 6 dígitos enviado a tu correo.</p>';
      label = 'Verificar correo';
    } else if (screen === 'recuperar') {
      fields = email(context.email);
      label = 'Enviar enlace de recuperación';
    } else {
      fields = (screen === 'cambiar' ? password('currentPassword', 'Contraseña actual', 'current-password') : '') + newPassword('Nueva contraseña') + confirmation();
      label = 'Guardar contraseña';
    }
    return `<form id="access-form" class="login-form" data-auth-screen="${screen}" novalidate>${fields}${['registro', 'restablecer', 'cambiar'].includes(screen) ? '<p id="password-help-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>' : ''}${feedback()}<button class="button btn-liquid-brand full" type="submit" data-submit-label="${label}">${label}</button>${screen === 'verificar' ? '<button class="button btn-liquid-light full auth-resend" type="button" data-auth-action="resend">Reenviar código</button>' : ''}</form>${links(screen)}`;
  }
  function layout(title, intro, content, assets = '') {
    return `<div class="auth-layout auth-flow">${brand('#inicio', 'El Chilito, inicio', 'auth-brand')}<aside class="auth-visual"><img src="${assets}vista/img/habanero-fondo.webp" alt="Hojas y frutos de habanero en una ambientación conceptual de interior." width="1896" height="830"><div class="auth-visual-shade"></div><div class="auth-quote"><h2><span>Tu huerto,</span><span>más cerca de ti.</span></h2><p>Tres plantas de habanero para cultivar en interiores.</p></div></aside><main class="auth-main" id="contenido" tabindex="-1"><div class="auth-form-wrap auth-bento"><h1 id="auth-title">${authEscape(title)}</h1><p class="auth-intro">${authEscape(intro)}</p><div id="auth-content">${content}</div></div></main></div>`;
  }
  return {
    layout,
    updatePasswordHelp(root, progress) {
      const counter = root.querySelector('#password-counter');
      if (!counter) return;
      const known = Number.isInteger(progress.minLength) && Number.isInteger(progress.maxLength);
      const minimumText = `Mínimo ${progress.minLength} caracteres`;
      counter.textContent = `${progress.length} ${progress.length === 1 ? 'carácter' : 'caracteres'}`;
      root.querySelector('[data-password-meter]').style.width = known ? `${Math.min(100,progress.length / progress.minLength * 100)}%` : '0%';
      root.querySelector('.password-length').classList.toggle('is-met',progress.range === 'within-range');
      counter.classList.toggle('is-error', progress.range === 'over-maximum');
      const setCheck = (element, met, text) => {
        element.querySelector('[data-password-check-icon]').innerHTML = met ? icon('check') : '';
        element.querySelector('[data-password-check-text]').textContent = text;
        element.classList.toggle('is-met', met);
      };
      const minimum = root.querySelector('#password-minimum');
      const inRange = progress.range === 'within-range';
      minimum.hidden = !known;
      setCheck(minimum, progress.meetsMinimum && inRange, progress.range === 'over-maximum' ? `Supera el máximo de ${progress.maxLength} caracteres` : minimumText);
      minimum.setAttribute('aria-label', `${minimumText}${inRange ? ', cumplido' : ''}`);
      const {hints} = progress;
      setCheck(root.querySelector('#password-tip-cases'), hints.cases, progress.numericOnly ? 'Solo números no se acepta: añade letras' : 'Mayúsculas y minúsculas');
      setCheck(root.querySelector('#password-tip-number'), hints.number, 'Números');
      setCheck(root.querySelector('#password-tip-symbol'), hints.symbol, 'Un símbolo, como ! # $ %');
      const usesEmail = root.querySelector('#password-tip-email');
      usesEmail.hidden = !hints.emailKnown;
      setCheck(usesEmail, progress.length > 0 && !hints.usesEmail, hints.usesEmail ? 'Incluye tu correo: elige otra' : 'No incluye tu correo');
      setCheck(root.querySelector('#confirmation-match'), progress.confirmation === 'matches', 'Las contraseñas coinciden');
    },
    title(screen) { return titles[screen]?.[0] || titles.acceso[0]; },
    render(screen, { config = AuthConfig, context = {}, assets = '', embedded = false, review = false } = {}) {
      if (embedded) return `<div class="auth-flow account-password bento-panel"><h1 id="auth-title">${titles[screen][0]}</h1><p class="auth-intro">${titles[screen][1]}</p><div id="auth-content">${form(screen, config, context)}</div></div>`;
      const previewHelp = '';
      const intro = screen === 'recuperar' ? 'Ingresa tu correo electrónico para enviarte las instrucciones de recuperación.' : titles[screen][1];
      return layout(titles[screen][0], intro, previewHelp + form(screen, config, context, review), assets);
    },
    message(title, text, action = 'Iniciar sesión', href = '#acceso') {
      return `<div class="auth-result" tabindex="-1"><span class="auth-result-icon" aria-hidden="true">${icon(href === '#recuperar' ? 'info' : 'check')}</span><h2>${authEscape(title)}</h2><p>${authEscape(text)}</p><a class="button btn-liquid-brand full" href="${href}">${authEscape(action)}</a></div>`;
    },
    resetChecking() { return '<div class="auth-feedback" role="status">Comprobando el enlace…</div>'; },
    resetUnavailable() { return '<div class="auth-feedback is-error" role="alert" tabindex="-1">No podemos comprobar el enlace en este momento. Inténtalo de nuevo.</div><button class="button btn-liquid-brand full" type="button" data-auth-action="check-reset">Reintentar</button><p class="auth-switch"><a href="#recuperar">Solicitar otro enlace</a></p>'; },
    sessionChecking() { return layout('Comprobando sesión', 'Espera un momento.', '<div class="auth-feedback" role="status">Comprobando tu acceso…</div>'); },
    form
  };
})();
