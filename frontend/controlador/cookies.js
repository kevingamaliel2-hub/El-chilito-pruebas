// Solo un botón guarda una decisión: cerrar la ventana o ignorar el aviso no es consentir.
// La decisión vive en el servidor y en una cookie firmada; nunca en localStorage.
const CookieController = (() => {
  const listeners = new Set();
  let state = null, root = null, banner = null, dialog = null, form = null, notice = null;
  let pending = null, saving = null, loadId = 0, failed = false, noticeTimer = null;
  const notify = () => listeners.forEach(listener => listener());
  const failure = 'No pudimos guardar tu elección. Inténtalo de nuevo';
  // Un aviso fijo no debe tapar el elemento que recibe el foco.
  function reserveSpace() {
    document.documentElement.style.scrollPaddingBottom = banner.hidden ? '' : `${banner.offsetHeight + 32}px`;
  }
  // Sin respuesta del servidor la decisión es desconocida: se vuelve a preguntar, nunca se presume.
  function paint() {
    banner.hidden = !failed && (!state || state.decided);
    reserveSpace();
  }
  function showError(text = '') {
    root.querySelectorAll('[data-cookies-error]').forEach(node => {
      node.textContent = text;
      node.hidden = !text;
    });
  }
  function announce(text) {
    notice.textContent = text;
    notice.hidden = false;
    // Si el foco estaba en el aviso que acaba de ocultarse, no se pierde al inicio de la página.
    const active = document.activeElement;
    if(active === document.body || banner.contains(active)) notice.focus({preventScroll:true});
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; },4500);
  }
  async function save(statistics) {
    const id = loadId;
    showError();
    CookieViews.busy(root,true);
    const result = await PrivacyData.decide(statistics);
    CookieViews.busy(root,false);
    if(result.status !== 'accepted') { showError(failure); return false; }
    // Si la identidad cambió mientras se guardaba, manda la consulta posterior del servidor.
    if(id === loadId) { state = {...state,decided:true,statistics}; failed = false; paint(); notify(); }
    return true;
  }
  // Una sola decisión a la vez: varias en curso podrían terminar fuera de orden.
  async function decide(statistics) {
    if(saving) return false;
    saving = save(statistics);
    try { return await saving; } finally { saving = null; }
  }
  async function choose(statistics) {
    if(!await decide(statistics)) return;
    if(dialog.open) dialog.close();
    announce('Preferencias guardadas');
  }
  function openPreferences() {
    form.elements.statistics.checked = state?.statistics === true;
    showError();
    if(!dialog.open) dialog.showModal();
  }
  function act(action) {
    if(action === 'aceptar') choose(true);
    if(action === 'rechazar') choose(false);
    if(action === 'configurar') openPreferences();
    if(action === 'cerrar') dialog.close();
  }
  function send(route) {
    const section = PrivacyModel.sectionOf(route);
    if(section) PrivacyData.section(section);
  }
  // Mientras no se conoce la decisión de esta identidad, las visitas esperan y no se cuentan.
  async function load() {
    const id = ++loadId;
    state = null;
    failed = false;
    paint();
    notify();
    await saving;
    if(id !== loadId) return;
    const result = await PrivacyData.cookies();
    if(id !== loadId) return;
    if(result.status !== 'ready') { failed = true; paint(); notify(); return; }
    state = result;
    paint();
    notify();
    if(pending && state.statistics) send(pending);
    pending = null;
  }
  function mount() {
    root = CookieViews.root();
    banner = root.querySelector('[data-cookies-aviso]');
    dialog = root.querySelector('[data-cookies-panel]');
    form = root.querySelector('[data-cookies-form]');
    notice = root.querySelector('[data-cookies-confirmacion]');
    document.body.append(root);
    form.addEventListener('submit',event => {
      event.preventDefault();
      choose(form.elements.statistics.checked);
    });
    document.addEventListener('click',event => {
      if(event.target.closest('[data-cookie-settings]')) { openPreferences(); return; }
      const action = event.target.closest('[data-cookies-accion]')?.dataset.cookiesAccion;
      if(action) act(action);
    });
    window.addEventListener('resize',reserveSpace);
  }
  function start() {
    mount();
    return load();
  }
  // Tras iniciar o cerrar sesión la decisión vigente puede ser otra.
  function refresh() {
    if(dialog?.open) dialog.close();
    return load();
  }
  function visit(route) {
    if(state === null) pending = route;
    else if(state.statistics) send(route);
  }
  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  return Object.freeze({start,refresh,visit,decide,onChange,
    get status(){return state ? {status:'ready',decided:state.decided === true,statistics:state.statistics === true} : {status:failed ? 'error' : 'loading',decided:false,statistics:false};}});
})();
