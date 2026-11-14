// Guías de cuidado: plantillas fijas. Todo el contenido del servidor se inserta como texto, nunca como HTML.
const CareGuideViews = (() => {
  const el = (tag, className, text) => Object.assign(document.createElement(tag), className ? {className} : {}, text !== undefined ? {textContent:text} : {});

  // Persona usuaria ------------------------------------------------------------------------------
  function slot() {
    return `<section class="care-guides" data-care-guides aria-labelledby="care-guides-title">
      <div class="user-section-heading"><div><h2 id="care-guides-title" tabindex="-1">Guía de cuidado y preguntas frecuentes</h2><p>Consulta cada etapa: germinación, trasplante, crecimiento y cosecha.</p></div></div>
      <p class="care-guides-notice" data-care-guides-notice role="status" hidden></p>
      <div data-care-guides-body></div>
    </section>`;
  }
  function item(guide, isOpen) {
    const details = el('details', 'bento-panel care-guide');
    details.dataset.guideKey = guide.key; details.open = isOpen;
    const answer = el('div', 'care-guide-answer');
    answer.append(...guide.paragraphs.map(text => el('p', '', text)));
    if(guide.source) answer.append(source(guide.source));
    details.append(el('summary', '', guide.question), answer);
    return details;
  }
  function source({name, url}) {
    const line = el('p', 'care-guide-source', 'Fuente: ');
    if(!url) { line.append(name); return line; }
    const link = el('a', '', name);
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    line.append(link, el('span', 'sr-only', ' (se abre en otra pestaña)'));
    return line;
  }
  function problem() {
    const box = el('div', 'bento-panel care-guides-problem');
    box.setAttribute('role', 'alert');
    const retry = el('button', 'button btn-liquid-light', 'Reintentar');
    retry.type = 'button'; retry.dataset.careGuideRetry = '';
    box.append(el('p', '', 'No se pudieron consultar las guías. El resto de la página sigue disponible.'), retry);
    return box;
  }
  function paint(section, state, opened) {
    const body = section.querySelector('[data-care-guides-body]');
    section.setAttribute('aria-busy', String(state.status === 'loading'));
    if(state.status === 'loading') { const note = el('p', 'care-guides-state', 'Consultando las guías…'); note.setAttribute('role', 'status'); body.replaceChildren(note); return; }
    if(state.status === 'error') { body.replaceChildren(problem()); return; }
    if(!state.items.length) { body.replaceChildren(el('p', 'bento-panel care-guides-state', 'Todavía no hay guías publicadas.')); return; }
    const list = el('div', 'care-guide-list');
    list.append(...state.items.map(guide => item(guide, opened.has(guide.key))));
    body.replaceChildren(list);
  }
  function openItem(section, key) {
    const details = [...section.querySelectorAll('[data-guide-key]')].find(node => node.dataset.guideKey === key);
    if(!details) return false;
    setNotice(section, '');
    details.open = true;
    details.scrollIntoView({block:'center'});
    details.querySelector('summary').focus();
    return true;
  }
  function setNotice(section, text) {
    const notice = section.querySelector('[data-care-guides-notice]');
    notice.hidden = !text; notice.textContent = text;
  }
  function focusSection(section, text) {
    setNotice(section, text);
    const title = section.querySelector('#care-guides-title');
    title.scrollIntoView({block:'start'});
    title.focus();
  }

  // Administración -------------------------------------------------------------------------------
  function field(id, name, label, control, help = '') {
    return `<div class="care-admin-field"><label for="${id}">${label}</label>${control}${help ? `<p class="binding-help" id="${id}-help">${help}</p>` : ''}</div>`;
  }
  function adminShell(limits) {
    const filter = (value, label, active = false) => `<button type="button" class="button compact btn-liquid-light${active ? ' active' : ''}" data-guide-filter="${value}" aria-pressed="${active}">${label}</button>`;
    return `${AppViews.heading('Guías de cuidado','Crea, edita y publica las preguntas que ven las personas en Mantenimiento. Las fichas son compartidas: no dependen de quién las creó.')}
      <div id="admin-feedback" class="user-feedback" role="status" tabindex="-1" hidden></div>
      <div class="care-admin-toolbar">
        <div class="care-admin-filters" role="group" aria-label="Filtrar por estado">${filter('','Todas',true)}${filter('publicada','Publicadas')}${filter('borrador','Borradores')}${filter('retirada','Retiradas')}</div>
        <button type="button" class="button btn-liquid-brand" data-guide-new>Nueva ficha</button>
      </div>
      <section class="bento-panel care-admin-editor" data-guide-editor aria-labelledby="care-admin-editor-title" hidden>
        <h2 id="care-admin-editor-title" tabindex="-1" data-guide-editor-title></h2>
        <p class="care-admin-hint" data-guide-editor-hint></p>
        <form class="care-admin-form" data-guide-form novalidate>
          ${field('care-question','question','Pregunta',`<input id="care-question" name="question" maxlength="${limits.question}" required autocomplete="off">`)}
          ${field('care-answer','answer','Respuesta',`<textarea id="care-answer" name="answer" rows="9" maxlength="${limits.answer}" required aria-describedby="care-answer-help"></textarea>`,'Solo texto. Deja una línea en blanco para separar párrafos.')}
          ${field('care-order','order','Orden',`<input id="care-order" name="order" inputmode="numeric" maxlength="4" required autocomplete="off" aria-describedby="care-order-help">`,'Número de 1 a 9999. Se muestra de menor a mayor.')}
          ${field('care-source-name','sourceName','Nombre de la fuente (opcional)',`<input id="care-source-name" name="sourceName" maxlength="${limits.sourceName}" autocomplete="off">`)}
          ${field('care-source-url','sourceUrl','Enlace de la fuente (opcional)',`<input id="care-source-url" name="sourceUrl" type="url" inputmode="url" maxlength="${limits.sourceUrl}" autocomplete="off" spellcheck="false" aria-describedby="care-source-url-help">`,'Solo http:// o https://.')}
          <p class="binding-status" data-guide-form-status role="status" tabindex="-1" hidden></p>
          <div class="care-admin-actions">
            <button type="submit" class="button btn-liquid-brand" data-guide-save></button>
            <button type="button" class="button btn-liquid-light" data-guide-cancel>Cancelar</button>
            <button type="button" class="button btn-liquid-light" data-guide-reload hidden>Cargar la versión actual (descarta lo escrito)</button>
          </div>
        </form>
      </section>
      <p class="care-guides-state" data-guide-summary role="status"></p>
      <div class="care-admin-list" data-guide-list></div>`;
  }
  function actionButton(label, data, value, question, primary = false) {
    const button = el('button', `button compact ${primary ? 'btn-liquid-brand' : 'btn-liquid-light'}`, label);
    button.type = 'button'; button.dataset[data] = value;
    button.setAttribute('aria-label', `${label}: ${question}`);
    return button;
  }
  function adminRow(guide, service) {
    const row = el('article', 'bento-panel care-admin-row');
    const main = el('div', 'care-admin-row-main');
    const state = el('span', `care-admin-state is-${guide.state}`, service.stateLabels[guide.state] || guide.state);
    const author = guide.updatedBy || 'Carga inicial';
    main.append(state, el('h3', '', guide.question), el('p', 'care-admin-meta', `Orden ${guide.order} · Última edición: ${author}, ${service.dateText(guide.updatedAt)}`));
    const actions = el('div', 'care-admin-row-actions');
    actions.append(actionButton('Editar', 'guideEdit', guide.id, guide.question));
    if(guide.state === 'borrador') actions.append(actionButton('Publicar', 'guidePublish', guide.id, guide.question, true));
    if(guide.state === 'retirada') actions.append(actionButton('Volver a publicar', 'guidePublish', guide.id, guide.question, true));
    if(guide.state === 'publicada') actions.append(actionButton('Retirar', 'guideWithdraw', guide.id, guide.question));
    row.append(main, actions);
    return row;
  }
  function adminList(host, summary, guides, service, filterName) {
    summary.textContent = guides.length ? `${guides.length} ficha${guides.length === 1 ? '' : 's'}` : (filterName ? 'No hay fichas en este filtro.' : 'Todavía no hay fichas.');
    host.replaceChildren(...guides.map(guide => adminRow(guide, service)));
  }
  function adminError(host, summary, text) {
    summary.textContent = '';
    const box = el('div', 'bento-panel care-guides-problem');
    box.setAttribute('role', 'alert');
    const retry = el('button', 'button btn-liquid-light', 'Reintentar');
    retry.type = 'button'; retry.dataset.guideRetry = '';
    box.append(el('p', '', text), retry);
    host.replaceChildren(box);
  }
  function setFilter(root, value) {
    root.querySelectorAll('[data-guide-filter]').forEach(button => {
      const active = button.dataset.guideFilter === value;
      button.setAttribute('aria-pressed', String(active)); button.classList.toggle('active', active);
    });
  }
  function fillEditor(editor, guide, texts) {
    const form = editor.querySelector('[data-guide-form]');
    form.reset();
    const v = guide || {};
    Object.assign(form.elements.question, {value:v.question || ''});
    Object.assign(form.elements.answer, {value:v.answer || ''});
    Object.assign(form.elements.order, {value:v.order ? String(v.order) : ''});
    Object.assign(form.elements.sourceName, {value:v.sourceName || ''});
    Object.assign(form.elements.sourceUrl, {value:v.sourceUrl || ''});
    editorLabels(editor, texts);
    markInvalid(form, null);
    formStatus(editor, '');
    staleOption(editor, false);
    editor.hidden = false;
  }
  function editorLabels(editor, texts) {
    editor.querySelector('[data-guide-editor-title]').textContent = texts.title;
    editor.querySelector('[data-guide-editor-hint]').textContent = texts.hint;
    editor.querySelector('[data-guide-save]').textContent = texts.save;
  }
  function readEditor(editor) {
    const f = editor.querySelector('[data-guide-form]').elements;
    return {question:f.question.value, answer:f.answer.value, order:f.order.value.trim(), sourceName:f.sourceName.value, sourceUrl:f.sourceUrl.value.trim()};
  }
  function markInvalid(form, name) {
    for(const control of form.querySelectorAll('input,textarea')) control.setAttribute('aria-invalid', String(control.name === name));
    if(name) form.elements[name].focus();
  }
  function formStatus(editor, text, {error = false, focus = error} = {}) {
    const node = editor.querySelector('[data-guide-form-status]');
    node.setAttribute('role', error ? 'alert' : 'status');
    node.hidden = !text; node.textContent = text;
    if(text && focus) node.focus();
  }
  function saving(editor, busy) {
    const form = editor.querySelector('[data-guide-form]');
    form.setAttribute('aria-busy', String(busy));
    form.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }
  function staleOption(editor, visible) { editor.querySelector('[data-guide-reload]').hidden = !visible; }
  function closeEditor(editor) { editor.hidden = true; }
  function focusEditor(editor) { const title = editor.querySelector('[data-guide-editor-title]'); title.scrollIntoView({block:'start'}); editor.querySelector('[name=question]').focus(); }
  return Object.freeze({slot, paint, openItem, focusSection, adminShell, adminList, adminError, setFilter, fillEditor, readEditor, markInvalid, formStatus, saving, staleOption, closeEditor, focusEditor});
})();
