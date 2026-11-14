const PrivacyViews = Object.freeze({
  account() {
    const tabs = '<nav class="account-tabs" aria-label="Apartados de mi cuenta"><a class="button btn-liquid-light" href="#cuenta">Perfil</a><a class="button btn-liquid-light" href="#cuenta/seguridad">Seguridad</a><a class="button btn-liquid-brand active" href="#cuenta/privacidad" aria-current="page">Privacidad</a></nav>';
    const documents = '<nav class="doc-links" aria-label="Documentos legales"><span>Documentos legales</span><a href="#privacidad">Aviso de privacidad</a><a href="#cookies">Política de cookies</a><a href="#terminos">Términos y condiciones</a></nav>';
    return `<div class="privacy-flow">${AppViews.heading('Privacidad','Consulta tus datos y decide sobre las estadísticas de este navegador.')}${tabs}<div data-my-privacy></div>${documents}</div>`;
  }
});
