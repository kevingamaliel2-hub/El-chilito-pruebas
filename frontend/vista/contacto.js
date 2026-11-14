const ContactViews = Object.freeze({
  dialog() {
    return `<dialog class="contact-screen" data-contact aria-labelledby="contact-title">
      <button class="button compact btn-liquid-nav account-icon-link contact-close" type="button" data-contact-close aria-label="Cerrar">${icon('close')}</button>
      <div class="contact-layout">
        <div class="contact-copy">
          <h2 id="contact-title">Cuéntanos qué quieres saber</h2>
          <p>Escríbenos sobre El Chilito y te responderemos a tu correo.</p>
          <ul><li>${icon('check')}<span>Pregunta por el precio y la disponibilidad.</span></li>
          <li>${icon('check')}<span>Pide que te avisemos cuando salga la primera versión.</span></li></ul>
          <p class="contact-direct" data-contact-direct hidden></p>
        </div>
        <form class="contact-form" data-contact-form novalidate>
          <label><span>Nombre <small>(opcional)</small></span><input name="name" maxlength="100" autocomplete="name"></label>
          <label>Correo electrónico<input name="email" type="email" maxlength="254" autocomplete="email" required></label>
          <label>Tu mensaje<textarea name="message" rows="5" maxlength="2000" required></textarea></label>
          <label class="contact-trap" aria-hidden="true">Sitio web<input name="website" tabindex="-1" autocomplete="off"></label>
          <p class="contact-note">Usaremos tu correo solo para responderte. Consulta el <a href="#privacidad">Aviso de privacidad</a>.</p>
          <p class="contact-status" data-contact-status role="status" hidden></p>
          <button class="button btn-liquid-primary" type="submit">Enviar mensaje</button>
        </form>
      </div>
    </dialog>`;
  },
  direct(host, contact) {
    const link = Object.assign(document.createElement('a'),{href:'mailto:'+contact,textContent:contact});
    host.replaceChildren('También puedes escribirnos a ',link,'.');
    host.hidden = false;
  }
});
