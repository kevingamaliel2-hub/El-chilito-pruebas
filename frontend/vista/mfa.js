// Pantallas de segundo factor. Lo que viene del servidor se pinta con textContent.
const MfaViews = Object.freeze({
  step(kind) {
    const byMail = kind === 'login_by_code';
    return `<form data-step class="login-form" novalidate><div class="field"><label for="code">${byMail?'Código de 6 dígitos':'Código de tu app o de recuperación'}</label>
      <input id="code" name="code" autocomplete="one-time-code" required ${byMail?'inputmode="numeric" maxlength="6"':'maxlength="64"'}></div>
      <p class="auth-help">${byMail?'Te lo enviamos por correo. Vence en 5 minutos.':'Si perdiste tu app, usa uno de tus códigos de recuperación.'}</p>
      ${byMail?'':'<a class="auth-text-link" href="#sin-acceso">No tengo mi app ni mis códigos</a>'}
      <div data-step-feedback class="auth-feedback is-error" role="alert" hidden></div>
      <div class="step-actions"><button class="button btn-liquid-brand" type="submit">Continuar</button>
      <button class="button btn-liquid-light" type="button" data-step-cancel>Cancelar</button>
      <button class="button btn-liquid-light" type="button" data-step-key hidden>Usar llave de acceso</button></div></form>`;
  },
  account() {
    const tabs = '<nav class="account-tabs" aria-label="Apartados de mi cuenta"><a class="button btn-liquid-light" href="#cuenta">Perfil</a><a class="button btn-liquid-brand active" href="#cuenta/seguridad" aria-current="page">Seguridad</a><a class="button btn-liquid-light" href="#cuenta/privacidad">Privacidad</a></nav>';
    return `${AppViews.heading('Seguridad','Elige cómo confirmas tu identidad al entrar.')}${tabs}
      <div id="mfa-feedback" class="user-feedback" role="status" tabindex="-1" hidden></div>
      <section class="bento-panel" data-mfa-required hidden role="alert"><h2>Activa un método para usar el panel</h2><p>Los administradores necesitan una app autenticadora o una llave de acceso.</p></section>
      <section class="bento-panel" data-mfa-reauth hidden><h2>Confirma tu contraseña</h2><form data-reauth class="maint-form"><label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label><button class="button btn-liquid-brand" type="submit">Confirmar</button></form></section>
      <div class="security-grid">
      <section class="bento-panel security-card"><h2>Código por correo</h2><p data-mail-state></p></section>
      <section class="bento-panel security-card"><h2>App autenticadora</h2><p data-totp-state></p>
        <div class="app-actions"><button class="button btn-liquid-brand" type="button" data-mfa="totp-start" hidden>Activar</button>
        <button class="button btn-liquid-light" type="button" data-mfa="totp-disable" hidden>Desactivar</button></div>
        <form data-totp-form class="maint-form" hidden><img data-totp-image alt="Código QR para tu app autenticadora" width="200" height="200"><p>Clave manual: <code data-totp-secret></code></p>
        <label>Código de la app<input name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></label><button class="button btn-liquid-brand" type="submit">Confirmar</button></form></section>
      <section class="bento-panel security-card"><h2>Llaves de acceso</h2><p>Usa la huella, el rostro o el PIN de tu dispositivo. Tu PIN y tu biometría nunca salen de él.</p><ul class="security-keys" data-keys aria-label="Llaves registradas"></ul>
        <form data-key-form class="key-form"><label for="key-name">Nombre de la llave</label><div class="key-form-row"><span class="key-form-icon">${icon('key')}</span><input id="key-name" name="name" maxlength="100" required placeholder="Ej. Teléfono personal" autocomplete="off"><button class="button btn-liquid-brand" type="submit">${icon('plus')}<span>Agregar llave</span></button></div></form></section>
      <section class="bento-panel security-card"><h2>Códigos de recuperación</h2><p data-recovery-state></p>
        <div class="app-actions"><button class="button btn-liquid-light" type="button" data-mfa="recovery-regenerate" hidden>Generar códigos nuevos</button></div>
        <div data-recovery-new hidden><p>Guárdalos ahora: no se volverán a mostrar. Cada uno sirve una sola vez.</p><ol data-recovery-list></ol></div></section>
      </div>`;
  },
  // Muestra el contacto que prepara el modelo: enlace si es un correo, texto si no lo es.
  supportContact(host, {text, href}) {
    host.hidden = false;
    if(!href) { host.textContent = text; return; }
    host.replaceChildren(Object.assign(document.createElement('a'),{textContent:text,href}));
  },
  // Una fila por llave: icono fijo, nombre como texto y botón para quitarla.
  methodItem(item) {
    const row = Object.assign(document.createElement('li'),{className:'key-item'});
    const mark = Object.assign(document.createElement('span'),{className:'key-item-icon'});
    mark.innerHTML = icon('key');
    const name = Object.assign(document.createElement('span'),{className:'key-item-name',textContent:item.name || 'Llave de acceso'});
    const remove = Object.assign(document.createElement('button'),{type:'button',className:'button btn-liquid-light key-item-remove',textContent:'Quitar'});
    remove.dataset.keyRemove = item.id;
    remove.setAttribute('aria-label','Quitar '+(item.name || 'llave de acceso'));
    row.append(mark,name,remove);
    return row;
  }
});
