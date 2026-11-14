// Buzón de consultas: estructura fija con plantilla y datos del servidor siempre como texto.
const InquiryViews = (() => {
  const filters = [['','Todas'],['nueva','Nuevas'],['atendida','Atendidas'],['archivada','Archivadas']];
  function shell() {
    return `${AppViews.heading('Solicitudes del producto','Consultas recibidas desde «Consíguelo». Responde desde tu correo y registra aquí su atención.')}
      <div id="admin-feedback" class="user-feedback" role="status" tabindex="-1" hidden></div>
      <nav class="account-tabs inquiry-filters" aria-label="Filtrar consultas">${filters.map(([value,label]) => `<button type="button" class="button btn-liquid-light" data-inq-filter="${value}" aria-pressed="false">${label}</button>`).join('')}</nav>
      <p class="inquiry-status" data-inq-status role="status"></p>
      <div class="inquiry-list" data-inq-list></div>
      <nav class="inquiry-pager" aria-label="Páginas del buzón" data-inq-pager hidden><button type="button" class="button btn-liquid-light" data-inq-page="-1">Anterior</button><span class="inquiry-page" data-inq-page-label></span><button type="button" class="button btn-liquid-light" data-inq-page="1">Siguiente</button></nav>`;
  }
  const el = (tag, className, text) => Object.assign(document.createElement(tag), className ? {className} : {}, text !== undefined ? {textContent:text} : {});
  function item(row, service) {
    const card = el('article', 'bento-panel inquiry-item');
    const head = el('div', 'inquiry-head');
    head.append(el('strong', 'inquiry-folio', row.folio), el('span', 'inquiry-state is-'+row.state, service.states[row.state] || row.state),
      Object.assign(el('time', 'inquiry-date', service.dateText(row.receivedAt)), {dateTime: row.receivedAt}));
    const who = el('p', 'inquiry-who');
    who.append(el('strong', '', row.name || 'Sin nombre'), document.createTextNode(' · '), el('span', '', row.email));
    const message = el('p', 'inquiry-message', row.message);
    const meta = el('p', 'inquiry-meta', [service.attentionText(row), service.notices[row.notice] || 'Sin aviso registrado'].join(' · '));
    const actions = el('div', 'app-actions');
    const href = service.replyHref(row);
    if(href) {
      const reply = Object.assign(el('a', 'button btn-liquid-light', 'Responder en Gmail'), {href, target:'_blank', rel:'noopener noreferrer'});
      reply.setAttribute('aria-label', `Responder a ${row.email} en Gmail (abre una pestaña nueva)`);
      actions.append(reply);
    }
    if(row.state !== 'atendida') actions.append(Object.assign(el('button', 'button btn-liquid-brand', 'Marcar como atendida'), {type:'button'}));
    if(row.state !== 'archivada') actions.append(Object.assign(el('button', 'button btn-liquid-light', 'Archivar'), {type:'button'}));
    actions.querySelectorAll('button').forEach(button => { button.dataset.inqId = row.id; button.dataset.inqState = button.textContent === 'Archivar' ? 'archivada' : 'atendida'; });
    card.append(head, who, message, meta, actions);
    return card;
  }
  return Object.freeze({shell, item});
})();
