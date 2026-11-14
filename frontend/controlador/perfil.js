const ProfileController = (() => {
  const names = ['firstName','lastName','alias'];
  const values = form => Object.fromEntries(names.map(name => [name,form.elements[name].value]));
  function fill(form, data) { for(const name of names) form.elements[name].value = data[name] || ''; }
  const failure = status => status === 'limited' ? 'Demasiados intentos. Espera un momento.' : 'No se pudieron guardar los cambios. Revisa los datos e inténtalo de nuevo.';
  function mount(host, data, {onSaved} = {}) {
    host.innerHTML = ProfileViews.form;
    const view = host.querySelector('[data-profile-view]');
    const facts = host.querySelector('[data-profile-facts]');
    const edit = host.querySelector('[data-profile-edit]');
    const form = host.querySelector('[data-profile]');
    const save = form.querySelector('[type=submit]');
    const cancel = form.querySelector('[data-profile-cancel]');
    const state = host.querySelector('[data-profile-state]');
    let saved = data, busy = false;
    function say(text = '') { state.textContent = text; state.hidden = !text; }
    function editing(active) { view.hidden = active; form.hidden = !active; }
    function setBusy(active) {
      busy = active;
      form.setAttribute('aria-busy',String(active));
      form.querySelectorAll('input,button').forEach(control => { control.disabled = active; });
      save.textContent = active ? 'Guardando…' : 'Guardar cambios';
    }
    ProfileViews.facts(facts,saved);
    edit.addEventListener('click',() => {
      fill(form,saved);
      say();
      editing(true);
      form.elements.firstName.focus();
    });
    cancel.addEventListener('click',() => {
      if(busy) return;
      fill(form,saved);
      say();
      editing(false);
      edit.focus();
    });
    form.addEventListener('submit',async event => {
      event.preventDefault();
      if(busy) return;
      setBusy(true);
      say('Guardando tus cambios…');
      const written = values(form);
      const result = await PrivacyData.saveProfile(written);
      if(result.status === 'unauthenticated') { ChilitoHTTP.sessionExpired(); return; }
      if(result.status !== 'accepted') { setBusy(false); say(failure(result.status)); return; }
      const session = await AuthService.restore();
      if(!form.isConnected) return;
      const confirmed = session?.profile?.profile;
      saved = confirmed || Object.fromEntries(names.map(name => [name,written[name].trim()]));
      ProfileViews.facts(facts,saved);
      setBusy(false);
      editing(false);
      say('Cambios guardados.');
      edit.focus();
      onSaved?.(session);
    });
  }
  return {mount};
})();

const WelcomeController = (() => {
  function offer(root, session, onDone) {
    if(session?.profile?.profile?.welcomePending !== true) return;
    root.insertAdjacentHTML('beforeend',ProfileViews.welcome);
    const dialog = root.querySelector('[data-welcome]');
    const form = dialog.querySelector('[data-welcome-form]');
    const state = dialog.querySelector('[data-profile-state]');
    async function finish(payload) {
      const result = await PrivacyData.welcome(payload);
      if(result.status !== 'accepted') { state.textContent = 'No se pudo guardar. Inténtalo de nuevo.'; state.hidden = false; return; }
      session.profile.profile.welcomePending = false;
      dialog.close(); dialog.remove();
      await AuthService.restore();
      onDone?.();
    }
    dialog.querySelector('[data-welcome-skip]').addEventListener('click',() => finish({}));
    form.addEventListener('submit',event => {
      event.preventDefault();
      finish(Object.fromEntries(['firstName','lastName','alias'].map(name => [name,form.elements[name].value])));
    });
    dialog.showModal();
  }
  return {offer};
})();

const MyPrivacyController = (() => {
  const labels = {email:'Correo electrónico',firstName:'Nombre',lastName:'Apellido',alias:'Alias',createdAt:'Cuenta creada',gardens:'Huertos'};
  const savedChoice = state => !state.decided ? '' : state.statistics ? 'yes' : 'no';
  const savedText = state => state.status === 'loading' ? 'Consultando…' : state.status === 'error' ? 'No se pudo consultar. Puedes guardar una decisión nueva.' : !state.decided ? 'Sin decisión guardada' : state.statistics ? 'Estadísticas permitidas' : 'Estadísticas no permitidas';
  function mount(host) {
    host.innerHTML = ProfileViews.myPrivacy;
    const list = host.querySelector('[data-my-data-list]');
    const consult = host.querySelector('[data-my-data]');
    const state = host.querySelector('[data-privacy-state]');
    const form = host.querySelector('[data-statistics-form]');
    const saved = host.querySelector('[data-statistics-saved]');
    const pending = host.querySelector('[data-statistics-pending]');
    const result = host.querySelector('[data-statistics-result]');
    const save = form.querySelector('[type=submit]');
    const radios = [...form.elements.statistics];
    let edited = false, saving = false;
    const selected = () => radios.find(radio => radio.checked)?.value || '';
    function report(text = '') { result.textContent = text; result.hidden = !text; }
    function sync() {
      const current = CookieController.status;
      saved.textContent = savedText(current);
      // Hasta que la persona elija, la selección refleja lo guardado; nunca al revés.
      if(!edited) radios.forEach(radio => { radio.checked = radio.value === savedChoice(current); });
      const changed = selected() !== '' && selected() !== savedChoice(current);
      pending.hidden = !changed;
      save.disabled = saving || !changed;
    }
    consult.addEventListener('click',async () => {
      consult.disabled = true;
      const data = await PrivacyData.myData();
      if(!consult.isConnected) return;
      consult.disabled = false;
      if(data.status !== 'accepted' || !data.data) { state.textContent = 'No se pudieron consultar tus datos. Inténtalo de nuevo.'; state.hidden = false; return; }
      state.hidden = true;
      list.replaceChildren(...Object.entries(labels).map(([key,label]) => {
        const value = key === 'gardens' ? data.data.gardens.join(', ') : key === 'createdAt' ? new Date(data.data.createdAt).toLocaleDateString('es-MX') : data.data[key];
        const row = document.createElement('div');
        row.append(Object.assign(document.createElement('dt'),{textContent:label}),Object.assign(document.createElement('dd'),{textContent:value || 'Sin dato'}));
        return row;
      }));
      list.hidden = false;
    });
    form.addEventListener('change',() => { edited = true; report(); sync(); });
    form.addEventListener('submit',async event => {
      event.preventDefault();
      if(saving || !selected()) return;
      saving = true;
      radios.forEach(radio => { radio.disabled = true; });
      save.textContent = 'Guardando…';
      sync();
      const stored = await CookieController.decide(selected() === 'yes');
      if(!form.isConnected) return;
      saving = false;
      radios.forEach(radio => { radio.disabled = false; });
      save.textContent = 'Guardar preferencias';
      if(stored) edited = false;
      sync();
      report(stored ? 'Preferencia guardada.' : 'No se pudo guardar tu preferencia. Sigue vigente la decisión anterior.');
    });
    const stop = CookieController.onChange(sync);
    sync();
    return {dispose: stop};
  }
  return {mount};
})();
