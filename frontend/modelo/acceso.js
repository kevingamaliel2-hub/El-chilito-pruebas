// Format validation only. Django/allauth validates credentials and permissions.
function hasEmailFormat(value) {
  const parts = value.split('@');
  if (parts.length !== 2 || value.length > 254) return false;
  const [local, domain] = parts;
  return local.length > 0 && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..')
    && domain.includes('.') && domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

// Fallback presentation policy; the active configuration is loaded from Django.
const AuthConfig = Object.freeze({
  registrationAllowed: false,
  password: Object.freeze({ minLength: null, maxLength: null, requirements: [] }),
  code: Object.freeze({ length: null, pattern: null, inputMode: 'text', expiresAfterSeconds: null, resendAfterSeconds: null }),
  requestTimeoutMs: 20000
});
const AuthModel = Object.freeze({
  screens: ['acceso', 'registro', 'verificar', 'recuperar', 'restablecer'],
  // Count code points, matching Python len(str), without altering the input.
  passwordLength(value) { return Array.from(value).length; },
  consumeResetLink(currentLocation, browserHistory) {
    const [path,query='']=currentLocation.hash.slice(1).split('?');
    if(path!=='restablecer')return '';
    const parameters=new URLSearchParams(query);
    const token=parameters.get('key')||parameters.get('token')||'';
    if(token)browserHistory.replaceState(null,'',currentLocation.pathname+currentLocation.search+'#restablecer');
    return token;
  },
  // Recomendaciones para orientar: no bloquean el envío ni son reglas del servidor.
  passwordHints(password, email = '') {
    const simple = value => value.toLowerCase().replace(/[^\p{L}\p{Nd}]/gu,'');
    const account = simple(email.split('@')[0] || '');
    return {cases:/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password),number:/\p{Nd}/u.test(password),
      symbol:/[^\p{L}\p{Nd}\s]/u.test(password),usesEmail:account.length >= 3 && simple(password).includes(account),emailKnown:account.length >= 3};
  },
  passwordProgress(password, confirmation = '', config = AuthConfig, email = '') {
    const length = this.passwordLength(password);
    const {minLength, maxLength} = config.password;
    const hasMinimum = Number.isInteger(minLength) && minLength > 0;
    const hasMaximum = Number.isInteger(maxLength) && maxLength > 0;
    return {length, minLength, maxLength, meetsMinimum:hasMinimum && length >= minLength,
      range:hasMaximum && length > maxLength ? 'over-maximum' : hasMinimum ? length < minLength ? 'below-minimum' : 'within-range' : 'unavailable',
      numericOnly:/^\p{Nd}+$/u.test(password),hints:this.passwordHints(password,email),
      confirmation:!confirmation ? 'empty' : password === confirmation ? 'matches' : 'differs'};
  },
  // Lo que solo sabe el servidor se explica al rechazar; la contraseña nunca sale de este envío.
  passwordRejection(code) {
    return {password_too_common:'Esa contraseña es demasiado común. Prueba con una frase larga que solo tú recuerdes.',
      password_too_similar:'Se parece demasiado a tu correo o a los datos de tu cuenta. Elige una distinta.',
      password_entirely_numeric:'No puede tener solo números. Añade palabras o letras.',
      password_too_short:'Es demasiado corta. Revisa el mínimo de caracteres.'}[code] || 'El servidor no aceptó esta contraseña. Elige otra distinta.';
  },
  validate(screen, values, config = AuthConfig) {
    const errors = {};
    if (['acceso', 'registro', 'verificar', 'recuperar'].includes(screen)) {
      const email = (values.email || '').trim();
      if (!email || /\s/.test(email) || !hasEmailFormat(email)) errors.email = 'Escribe un correo válido, como nombre@dominio.com.';
    }
    if (['acceso', 'registro', 'restablecer', 'cambiar'].includes(screen)) {
      const password = values.password || '';
      if (!password) errors.password = 'Escribe tu contraseña.';
      else if (screen !== 'acceso') {
        const policy = config.password;
        if (policy.minLength && this.passwordLength(password) < policy.minLength) errors.password = `Usa al menos ${policy.minLength} caracteres.`;
        if (policy.maxLength && this.passwordLength(password) > policy.maxLength) errors.password = `Usa como máximo ${policy.maxLength} caracteres.`;
      }
    }
    if (screen === 'cambiar' && !(values.currentPassword || '')) errors.currentPassword = 'Escribe tu contraseña actual.';
    if (['registro', 'restablecer', 'cambiar'].includes(screen)) {
      if (!values.confirmation) errors.confirmation = 'Confirma tu contraseña.';
      else if (values.confirmation !== values.password) errors.confirmation = 'Las contraseñas no coinciden.';
    }
    if (screen === 'registro' && values.termsAccepted !== true) errors.termsAccepted = 'Debes aceptar los Términos y condiciones para continuar';
    if (screen === 'registro' && values.privacyRead !== true) errors.privacyRead = 'Debes confirmar que leíste el Aviso de privacidad para continuar';
    if (screen === 'verificar') {
      const code = (values.code || '').trim();
      if (!code) errors.code = 'Escribe el código de verificación.';
      else if (config.code.length && code.length !== config.code.length) errors.code = `El código debe tener ${config.code.length} caracteres.`;
      else if (config.code.pattern && !new RegExp(config.code.pattern).test(code)) errors.code = 'Revisa el formato del código.';
    }
    return errors;
  },
  secondsLeft(deadline, now = Date.now()) {
    return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  },
  deadline(seconds, now = Date.now()) {
    return Number.isFinite(seconds) && seconds > 0 ? now + Math.min(seconds, 86400) * 1000 : 0;
  },
  expiry(value) {
    const time = typeof value === 'string' ? Date.parse(value) : value;
    return Number.isFinite(time) && time > 0 ? time : 0;
  },
  duration(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
});
