// Guías de cuidado: eventos y coordinación. El servidor confirma; aquí nunca se supone un éxito.
const CareGuideUserController = (() => {
  const LOAD_TIMEOUT_MS = 20000;
  const MISSING = 'Esa ficha ya no está publicada. Aquí tienes las guías disponibles.';
  // Devuelve paint: la pantalla de Mantenimiento se redibuja con cada carga del huerto.
  function attach({root, signal, screen, detail = '', service = CareGuideService}) {
    if(screen !== 'mantenimiento') return {paint() {}};
    const targets = new Map([['sustrato', service.SUBSTRATE_KEY], ['guias', null]]);
    const opened = new Set();
    let state = {status:'loading', items:[]}, serial = 0, settled = false;
    let pending = targets.has(detail) ? {key:targets.get(detail)} : null;
    const section = () => root.querySelector('[data-care-guides]');
    function reveal() {
      const node = section();
      if(!pending || !node || state.status === 'loading') return;
      const {key} = pending; pending = null;
      if(key && state.status === 'ready' && CareGuideViews.openItem(node, key)) { opened.add(key); return; }
      CareGuideViews.focusSection(node, key && state.status === 'ready' ? MISSING : '');
    }
    function paint(gardenSettled = settled) {
      settled = gardenSettled;
      const node = section();
      if(!node) return;
      CareGuideViews.paint(node, state, opened);
      if(settled) reveal();
    }
    async function load({focus = false} = {}) {
      const id = ++serial;
      // El foco se aplica cuando termine la carga y también la del huerto, que redibuja la pantalla.
      if(focus) pending = {key:null};
      state = {status:'loading', items:[]}; paint();
      const request = new AbortController(), abort = () => request.abort();
      signal.addEventListener('abort', abort, {once:true});
      const timeout = setTimeout(abort, LOAD_TIMEOUT_MS);
      const result = await service.published({signal:request.signal});
      clearTimeout(timeout); signal.removeEventListener('abort', abort);
      if(signal.aborted || id !== serial) return;
      state = result.status === 'ready' ? {status:'ready', items:result.items} : {status:'error', items:[]};
      paint();
    }
    root.addEventListener('toggle', event => {
      const key = event.target.dataset?.guideKey;
      if(key) { if(event.target.open) opened.add(key); else opened.delete(key); }
    }, {signal, capture:true});
    root.addEventListener('click', event => {
      if(event.target.closest('[data-care-guide-retry]')) { load({focus:true}); return; }
      const link = event.target.closest('[data-care-guide-link]');
      if(!link) return;
      // Ya en esta pantalla: se abre directamente, también si la ruta no cambia.
      event.preventDefault();
      pending = {key:link.dataset.careGuideLink};
      reveal();
    }, {signal});
    load();
    return {paint};
  }
  return Object.freeze({attach});
})();

const CareGuideAdminController = (() => {
  const failures = {
    forbidden:'Tu cuenta no tiene la capacidad para gestionar guías.',
    mfa:'Activa tu app autenticadora o una llave de acceso para gestionar guías.',
    limited:'Demasiadas operaciones seguidas. Espera un momento.',
    invalid:'Revisa los datos: alguna longitud, número o enlace no es válido.',
    conflict:'No se pudo guardar por un conflicto. Inténtalo de nuevo.'};
  const UNCERTAIN = 'No pudimos confirmar el resultado. Vuelve a intentarlo sin cambiar nada: no se duplicará.';
  const STALE_LIST = 'Otra persona cambió esa ficha. Se actualizó la lista: revísala antes de repetir la acción.';
  const STALE_FORM = 'Otra persona cambió esta ficha mientras la editabas. No se guardó nada y tu texto sigue aquí. Cópialo si lo necesitas y carga la versión actual.';
  const DIRTY = 'Tienes cambios sin guardar en el formulario. Guárdalos o pulsa Cancelar antes de continuar.';
  const uncertain = status => status === 'network' || status === 'error';
  function mount({root, service = CareGuideService} = {}) {
    const life = new AbortController();
    root.innerHTML = CareGuideViews.adminShell(service.LIMITS);
    const editor = root.querySelector('[data-guide-editor]'), form = editor.querySelector('[data-guide-form]');
    const list = root.querySelector('[data-guide-list]'), summary = root.querySelector('[data-guide-summary]'), feedback = root.querySelector('#admin-feedback');
    let guides = [], filter = '', editing = null, dirty = false, busy = false;   // editing: null cerrado, {} nueva, o la ficha
    function say(text, error = false) {
      feedback.setAttribute('role', error ? 'alert' : 'status');
      feedback.hidden = !text; feedback.textContent = text;
      if(text) feedback.focus();
    }
    const failureText = (status, fallback) => uncertain(status) ? UNCERTAIN : failures[status] || fallback;
    const findGuide = id => guides.find(guide => guide.id === id);
    const editingState = () => editing?.state || 'nueva';
    function open(guide) {
      editing = guide || {}; dirty = false;
      CareGuideViews.fillEditor(editor, guide, service.editorTexts[editingState()]);
      CareGuideViews.focusEditor(editor);
    }
    function close() { editing = null; dirty = false; CareGuideViews.closeEditor(editor); }
    function paintList() {
      CareGuideViews.setFilter(root, filter);
      CareGuideViews.adminList(list, summary, filter ? guides.filter(guide => guide.state === filter) : guides, service, filter);
    }
    async function load() {
      summary.textContent = 'Consultando las fichas…';
      const result = await service.panel();
      if(life.signal.aborted) return false;
      if(result.status !== 'ready') { CareGuideViews.adminError(list, summary, failures[result.status] || 'No se pudieron consultar las fichas.'); return false; }
      guides = result.guides;
      paintList();
      // Sin cambios propios, el formulario sigue a la versión más reciente de la ficha.
      if(editing?.id && !dirty) { const fresh = findGuide(editing.id); if(fresh) { editing = fresh; CareGuideViews.fillEditor(editor, fresh, service.editorTexts[fresh.state]); } }
      return true;
    }
    async function save() {
      const values = CareGuideViews.readEditor(editor);
      const problem = service.check(values);
      if(problem) { CareGuideViews.markInvalid(form, problem.field); CareGuideViews.formStatus(editor, problem.message, {error:true, focus:false}); return; }
      CareGuideViews.markInvalid(form, null);
      busy = true; CareGuideViews.saving(editor, true);
      CareGuideViews.formStatus(editor, 'Guardando…');
      const wasState = editingState();
      const result = editing.id ? await service.update(editing.id, editing.version, values) : await service.create(values);
      busy = false; if(life.signal.aborted) return;
      CareGuideViews.saving(editor, false);
      if(result.status === 'accepted') {
        close();
        await load();
        say(wasState === 'publicada' ? 'Cambios guardados y visibles para las personas usuarias.' : wasState === 'retirada' ? 'Cambios guardados. La ficha sigue retirada.' : 'Borrador guardado. Todavía no es visible para las personas usuarias.');
        return;
      }
      if(result.status === 'stale') {
        CareGuideViews.staleOption(editor, true);
        CareGuideViews.formStatus(editor, STALE_FORM, {error:true});
        await load();
        return;
      }
      CareGuideViews.formStatus(editor, failureText(result.status, 'No se pudo guardar la ficha.'), {error:true});
    }
    async function changeState(action, guideId, done, fallback) {
      const guide = findGuide(guideId);
      if(!guide || busy) return;
      if(dirty) { say(DIRTY, true); return; }
      busy = true;
      list.querySelectorAll('button').forEach(button => { button.disabled = true; });
      summary.textContent = 'Aplicando el cambio…';
      const result = await action(guide.id, guide.version);
      busy = false; if(life.signal.aborted) return;
      await load();
      if(result.status === 'accepted') say(done);
      else say(result.status === 'stale' ? STALE_LIST : failureText(result.status, fallback), true);
    }
    root.addEventListener('click', event => {
      const target = event.target;
      const filterButton = target.closest('[data-guide-filter]');
      if(filterButton) { filter = filterButton.dataset.guideFilter; paintList(); return; }
      if(target.closest('[data-guide-retry]')) { load(); return; }
      if(target.closest('[data-guide-cancel]')) { if(!busy) { close(); say(''); root.querySelector('[data-guide-new]').focus(); } return; }
      if(target.closest('[data-guide-reload]')) {
        const fresh = editing && findGuide(editing.id);
        if(fresh && !busy) { dirty = false; open(fresh); }
        return;
      }
      if(target.closest('[data-guide-new]') || target.closest('[data-guide-edit]')) {
        if(busy) return;
        if(dirty) { say(DIRTY, true); return; }
        say('');
        const edit = target.closest('[data-guide-edit]');
        open(edit ? findGuide(edit.dataset.guideEdit) : null);
        return;
      }
      const publish = target.closest('[data-guide-publish]');
      if(publish) { changeState(service.publish, publish.dataset.guidePublish, 'Ficha publicada. Ya es visible para las personas usuarias.', 'No se pudo publicar la ficha.'); return; }
      const withdraw = target.closest('[data-guide-withdraw]');
      if(withdraw) changeState(service.withdraw, withdraw.dataset.guideWithdraw, 'Ficha retirada. Ya no es visible; puedes consultarla en Retiradas.', 'No se pudo retirar la ficha.');
    }, {signal:life.signal});
    form.addEventListener('input', () => { dirty = true; }, {signal:life.signal});
    form.addEventListener('submit', event => {
      event.preventDefault();
      if(!busy && editing) save();
    }, {signal:life.signal});
    load();
    return {dispose() { life.abort(); }};
  }
  return Object.freeze({mount});
})();
