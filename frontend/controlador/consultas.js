// Coordina filtro, páginas y avance de atención del buzón de consultas.
const InquiryController = (() => {
  const messages = {forbidden:'Tu cuenta no tiene la capacidad para atender consultas.', stale:'No se guardó el cambio: ese paso no está permitido o la consulta ya había cambiado. Se actualizó la lista.', limited:'Demasiadas operaciones seguidas. Espera un momento.'};
  function mount({root, service = InquiryService} = {}) {
    const life = new AbortController();
    root.innerHTML = InquiryViews.shell();
    const list = root.querySelector('[data-inq-list]'), status = root.querySelector('[data-inq-status]'), feedback = root.querySelector('#admin-feedback');
    let state = '', page = 1, total = 0, busy = false;
    function say(text, error = false) { feedback.hidden = !text; feedback.textContent = text; feedback.setAttribute('role', error ? 'alert' : 'status'); }
    const REFRESH_MS = 30000;
    let shown = '';
    const signature = result => JSON.stringify([result.total, result.items.map(row => [row.id, row.state, row.notice])]);
    // Solo redibuja si llegó algo nuevo, para no mover el foco de quien está leyendo.
    async function refresh() {
      if(busy || document.visibilityState !== 'visible') return;
      const result = await service.list(state, page, {background:true});
      if(!life.signal.aborted && !busy && result.status === 'ready' && signature(result) !== shown) await load();
    }
    async function load() {
      status.textContent = 'Consultando el buzón…';
      const result = await service.list(state, page);
      if(life.signal.aborted) return;
      root.querySelectorAll('[data-inq-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.inqFilter === state)));
      root.querySelectorAll('[data-inq-filter]').forEach(button => button.classList.toggle('active', button.dataset.inqFilter === state));
      if(result.status !== 'ready') { list.replaceChildren(); root.querySelector('[data-inq-pager]').hidden = true; status.textContent = messages[result.status] || 'No se pudo consultar el buzón. Inténtalo de nuevo.'; return; }
      total = result.total;
      shown = signature(result);
      list.replaceChildren(...result.items.map(row => InquiryViews.item(row, service)));
      status.textContent = total ? `${total} consulta${total === 1 ? '' : 's'}` : 'No hay consultas en este filtro.';
      // Con una sola página no hay nada que paginar: los botones solo aparecen cuando sirven.
      const pages = Math.max(1, Math.ceil(total / 25));
      root.querySelector('[data-inq-pager]').hidden = pages <= 1;
      root.querySelector('[data-inq-page-label]').textContent = `Página ${page} de ${pages}`;
      root.querySelector('[data-inq-page="-1"]').disabled = page <= 1;
      root.querySelector('[data-inq-page="1"]').disabled = page >= pages;
    }
    root.addEventListener('click', async event => {
      const filter = event.target.closest('[data-inq-filter]');
      if(filter) { state = filter.dataset.inqFilter; page = 1; say(''); await load(); return; }
      const pager = event.target.closest('[data-inq-page]');
      if(pager) { page = Math.max(1, page + Number(pager.dataset.inqPage)); await load(); list.firstElementChild?.scrollIntoView({block:'nearest'}); return; }
      const action = event.target.closest('[data-inq-id]');
      if(!action || busy) return;
      busy = true; action.disabled = true;
      const result = await service.advance(action.dataset.inqId, action.dataset.inqState);
      busy = false;
      if(life.signal.aborted) return;
      say(result.status === 'accepted' ? (action.dataset.inqState === 'archivada' ? 'Consulta archivada.' : 'Consulta marcada como atendida.') : (messages[result.status] || 'No se pudo actualizar la consulta.'), result.status !== 'accepted');
      await load();
    }, {signal: life.signal});
    load();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh, {signal: life.signal});
    return {dispose() { clearInterval(timer); life.abort(); }};
  }
  return Object.freeze({mount});
})();
