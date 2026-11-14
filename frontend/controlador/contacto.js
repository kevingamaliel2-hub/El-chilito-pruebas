// Pantalla de preguntas: crece desde su botón. La entrega al correo la hace el servidor.
const ContactController = (() => {
  const messages = {accepted:'Recibimos tu mensaje. Te responderemos a tu correo.',invalid:'Revisa tu correo y tu mensaje.',limited:'Enviaste varios mensajes seguidos. Inténtalo más tarde.',unavailable:'No se pudo enviar. Inténtalo más tarde o escríbenos por correo.'};
  function mount(root) {
    const dialog = root.querySelector('[data-contact]');
    const trigger = root.querySelector('[data-contact-open]');
    const form = dialog.querySelector('[data-contact-form]');
    const status = dialog.querySelector('[data-contact-status]');
    const submit = form.querySelector('[type=submit]');
    const contact = ChilitoHTTP.configuration?.supportContact;
    if(contact) ContactViews.direct(dialog.querySelector('[data-contact-direct]'),contact);
    function say(text) { status.textContent = text; status.hidden = !text; }
    function open() {
      const area = trigger.getBoundingClientRect();
      dialog.style.setProperty('--from',`inset(${area.top}px ${innerWidth-area.right}px ${innerHeight-area.bottom}px ${area.left}px round 999px)`);
      say('');
      dialog.showModal();
    }
    function close() {
      if(!dialog.open) return;
      if(matchMedia('(prefers-reduced-motion: reduce)').matches) { dialog.close(); return; }
      dialog.classList.add('is-closing');
      dialog.addEventListener('animationend',() => dialog.close(),{once:true});
    }
    trigger.addEventListener('click',open);
    dialog.querySelector('[data-contact-close]').addEventListener('click',close);
    dialog.addEventListener('cancel',event => { event.preventDefault(); close(); });
    // El navegador puede cerrar sin esperar la animación: el estado se restablece siempre aquí.
    dialog.addEventListener('close',() => { dialog.classList.remove('is-closing'); trigger.focus({preventScroll:true}); });
    dialog.addEventListener('click',event => { if(event.target.closest('a[href^="#"]')) { dialog.close(); } });
    form.addEventListener('submit',async event => {
      event.preventDefault();
      if(submit.disabled) return;
      const values = Object.fromEntries(new FormData(form));
      if(!ProductContact.validEmail(values.email.trim()) || !values.message.trim()) { say(messages.invalid); return; }
      submit.disabled = true;
      submit.textContent = 'Enviando…';
      const result = await ProductContact.send(values);
      if(!form.isConnected) return;
      submit.disabled = false;
      submit.textContent = 'Enviar mensaje';
      say(messages[result]);
      if(result === 'accepted') form.reset();
    });
  }
  return {mount};
})();
