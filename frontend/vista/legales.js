const LegalViews = Object.freeze({
  // Texto del servidor: solo textContent. Admite títulos «##» y párrafos.
  fill(host, result) {
    if(!host) return;
    host.replaceChildren();
    host.removeAttribute('role');
    if(result.status !== 'ready') {
      const message = document.createElement('p');
      message.textContent = 'No se pudo cargar el documento. Inténtalo de nuevo.';
      host.append(message);
      return;
    }
    for(const block of result.text.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)) {
      if(block.startsWith('# ')) continue;
      const node = document.createElement(block.startsWith('## ') ? 'h3' : 'p');
      node.textContent = block.replace(/^## /,'');
      // Los huecos del borrador se ven como tales: nunca se presentan como texto aprobado.
      if(block.startsWith('[PENDIENTE')) node.className = 'legal-pending';
      host.append(node);
    }
  },
  // Pasos para quien perdió su app, sus llaves y sus códigos. El contacto se añade por separado.
  accessHelp() {
    const steps = ['Escribe a soporte desde el correo de tu cuenta. Así podemos saber que el mensaje viene de ti.',
      'Dinos qué perdiste y la fecha aproximada en que te registraste. Nunca envíes tu contraseña ni códigos.',
      'Comprobaremos tu identidad. Si coincide, retiraremos los métodos de tu cuenta y te avisaremos.',
      'Entra con tu correo y tu contraseña: recibirás un código por correo. Después vuelve a activar tu método en Seguridad.'];
    return `<ol class="access-help-steps">${steps.map(step => `<li>${authEscape(step)}</li>`).join('')}</ol>
      <p class="access-help-contact" data-step-contact hidden></p>
      <a class="button btn-liquid-brand full" href="#segundo-paso">Volver al inicio de sesión</a>`;
  },
  // Página de documento: título, entradilla y texto a lo ancho de lectura, sin fichas.
  // Al final, enlaces de texto a los demás documentos; no hay «Volver»: el encabezado es el de la portada y ya lleva a ella o al panel.
  render(document, route) {
    const title = document.title;
    const leads = {privacidad:'Qué datos personales tratamos, para qué los usamos y cómo puedes ejercer tus derechos.',
      terminos:'Condiciones de uso de la plataforma El Chilito y de sus servicios.',
      cookies:'Qué cookies usamos, para qué sirven y cómo cambiar tu elección.'};
    const related = Object.entries(PrivacyModel.documents).filter(([id]) => id !== route)
      .map(([id,item]) => `<li><a href="#${id}">${authEscape(item.title)}</a></li>`).join('');
    return `${publicHeader()}
      <main class="legal-page" id="contenido" tabindex="-1">
        <div class="legal-hero"><div class="legal-wrap">
          <p class="legal-eyebrow">Documentos legales · El Chilito</p>
          <h1>${authEscape(title)}</h1>
          <p class="legal-lead">${authEscape(leads[route] || '')}</p>
        </div></div>
        <div class="legal-wrap legal-body">
          <article class="legal-prose" aria-label="${authEscape(title)}"><div data-legal-text role="status"><p>Cargando documento…</p></div></article>
          <nav class="legal-related" aria-labelledby="legal-related-title">
            <h2 id="legal-related-title">Documentos relacionados</h2>
            <ul>${related}${route === 'cookies' ? '<li><button class="legal-link" type="button" data-cookie-settings>Configurar cookies</button></li>' : ''}</ul>
          </nav>
        </div>
      </main>${publicFooter()}`;
  }
});
