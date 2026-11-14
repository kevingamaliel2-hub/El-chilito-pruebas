const MaintenanceController = (() => {
  const messages = {stale:'Otra persona cambió este registro. Revísalo de nuevo antes de continuar.',forbidden:'Tu cuenta no tiene acceso a este huerto.',invalid:'Revisa los datos e inténtalo de nuevo.',limited:'Demasiadas operaciones. Espera un momento.'};
  const textOf = status => messages[status] || 'No se pudo completar la operación. Inténtalo de nuevo.';
  function mountDateFilters(filter, signal) {
    const dates = MaintenanceDates;
    const fields = ['since','until'].map(name => filter.elements.namedItem(name));
    const picker = MaintenanceViews.datePicker();
    document.body.append(picker);
    let active = null, opener = null, focused = dates.today();
    function validate() {
      for(const field of fields) {
        field.setCustomValidity(field.value && !dates.parse(field.value) ? 'Escribe una fecha válida con el formato AAAA-MM-DD.' : '');
      }
      const [since,until] = fields;
      if(dates.parse(since.value) && dates.parse(until.value) && since.value > until.value) {
        until.setCustomValidity('Hasta debe ser igual o posterior a Desde.');
      }
      for(const field of fields) {
        if(field.validity.valid) field.removeAttribute('aria-invalid');
        else field.setAttribute('aria-invalid','true');
      }
      return fields.find(field => !field.validity.valid)?.validationMessage || '';
    }
    function position() {
      if(!active) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const anchor = active.parentElement.getBoundingClientRect();
      picker.style.maxHeight = `${Math.max(0,height-16)}px`;
      picker.style.maxWidth = `${Math.max(0,width-16)}px`;
      const box = picker.getBoundingClientRect();
      const below = top+height-anchor.bottom-8, above = anchor.top-top-8;
      let y = below >= box.height || below >= above ? anchor.bottom+8 : anchor.top-box.height-8;
      y = Math.max(top+8,Math.min(y,top+height-box.height-8));
      picker.style.left = `${Math.max(left+8,Math.min(anchor.left,left+width-box.width-8))}px`;
      picker.style.top = `${y}px`;
    }
    function render(focusDay = false) {
      const year = focused.getUTCFullYear(), month = focused.getUTCMonth();
      picker.querySelector('[data-date-year]').setCustomValidity('');
      MaintenanceViews.renderCalendar(picker,{year,month,days:dates.weeks(year,month),
        selected:active.value,today:dates.format(dates.today()),focused:dates.format(focused)});
      position();
      if(focusDay) picker.querySelector('[data-date-value][tabindex="0"]')?.focus({preventScroll:true});
    }
    function close(restore = true) {
      if(!active) return;
      const target = opener;
      opener.setAttribute('aria-expanded','false');
      if(picker.hidePopover && picker.matches(':popover-open')) picker.hidePopover();
      picker.hidden = true;
      active = null; opener = null;
      if(restore && target.isConnected) target.focus({preventScroll:true});
    }
    function open(field, button) {
      if(active === field) { close(); return; }
      close(false);
      active = field; opener = button;
      focused = dates.parse(field.value) || dates.today();
      picker.querySelector('[data-date-year]').setCustomValidity('');
      picker.querySelector('#maint-calendar-title').textContent = `Calendario: ${field.name === 'since' ? 'Desde' : 'Hasta'}`;
      opener.setAttribute('aria-expanded','true');
      picker.hidden = false;
      if(picker.showPopover) picker.showPopover();
      render(true);
    }
    function select(value) {
      const field = active;
      field.value = value;
      validate(); close();
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
    filter.querySelectorAll('[data-date-open]').forEach(button => {
      const field = filter.elements.namedItem(button.dataset.dateOpen);
      button.addEventListener('click',() => open(field,button),{signal});
      field.addEventListener('input',validate,{signal});
      field.addEventListener('keydown',event => {
        if(event.key === 'Escape' && active) { event.preventDefault(); close(); return; }
        if(event.key === 'ArrowDown' || event.key === 'Enter') {
          event.preventDefault(); open(field,button);
        }
      },{signal});
    });
    picker.addEventListener('click',event => {
      const day = event.target.closest('[data-date-value]');
      if(day) { select(day.dataset.dateValue); return; }
      const action = event.target.closest('[data-date-action]')?.dataset.dateAction;
      if(action === 'close') close();
      if(action === 'clear') select('');
      if(action === 'today') select(dates.format(dates.today()));
      if(action === 'prev' || action === 'next') { focused = dates.shift(focused,0,action === 'prev' ? -1 : 1); render(); }
    },{signal});
    picker.addEventListener('change',event => {
      if(!event.target.matches('[data-date-month],[data-date-year]')) return;
      const year = Number(picker.querySelector('[data-date-year]').value);
      const month = Number(picker.querySelector('[data-date-month]').value);
      const yearField = picker.querySelector('[data-date-year]');
      if(!Number.isInteger(year) || year < 1 || year > 9999) {
        yearField.setCustomValidity('Escribe un año entre 1 y 9999.'); yearField.reportValidity(); return;
      }
      yearField.setCustomValidity('');
      focused = dates.make(year,month,Math.min(focused.getUTCDate(),dates.make(year,month+1,0).getUTCDate()));
      render();
    },{signal});
    picker.addEventListener('keydown',event => {
      if(event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if(event.key === 'Tab') {
        const stops = [...picker.querySelectorAll('button:not(:disabled),input,select')].filter(item => item.tabIndex >= 0);
        if((event.shiftKey && event.target === stops[0]) || (!event.shiftKey && event.target === stops.at(-1))) {
          event.preventDefault();
          let target = opener;
          if(!event.shiftKey) {
            const controls = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
              .filter(item => !picker.contains(item) && item.tabIndex >= 0 && !item.disabled && item.getClientRects().length);
            target = controls[controls.indexOf(opener)+1] || opener;
          }
          close(false); target.focus();
        }
        return;
      }
      const day = event.target.closest('[data-date-value]');
      if(!day) return;
      const date = dates.parse(day.dataset.dateValue);
      const weekday = (date.getUTCDay()+6)%7;
      const steps = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday};
      if(Object.hasOwn(steps,event.key)) focused = dates.shift(date,steps[event.key]);
      else if(event.key === 'PageUp' || event.key === 'PageDown') focused = dates.shift(date,0,(event.key === 'PageUp' ? -1 : 1)*(event.shiftKey ? 12 : 1));
      else return; // Enter y espacio conservan la activación nativa del botón.
      event.preventDefault(); render(true);
    },{signal});
    document.addEventListener('pointerdown',event => {
      if(active && !picker.contains(event.target) && !active.parentElement.contains(event.target) && !event.target.closest('[data-date-open]')) close();
    },{signal});
    document.addEventListener('focusin',event => {
      if(active && !picker.contains(event.target) && !active.parentElement.contains(event.target)) close(false);
    },{signal});
    window.addEventListener('resize',position,{signal});
    window.addEventListener('scroll',position,{signal,capture:true});
    window.visualViewport?.addEventListener('resize',position,{signal});
    window.visualViewport?.addEventListener('scroll',position,{signal});
    const resize = new ResizeObserver(position);
    resize.observe(picker);
    resize.observe(filter.closest('#app-page') || filter);
    document.fonts?.ready.then(() => { if(!signal.aborted) position(); });
    signal.addEventListener('abort',() => { resize.disconnect(); close(false); picker.remove(); },{once:true});
    return {validate};
  }
  function mount({root, service = MaintenanceService} = {}) {
    const life = new AbortController();
    root.innerHTML = MaintenanceViews.shell();
    const dialog = root.querySelector('[data-maint-dialog]');
    const status = root.querySelector('[data-maint-status]');
    const filter = root.querySelector('[data-maint-filter]');
    const dateFilters = mountDateFilters(filter,life.signal);
    const revise = root.querySelector('[data-maint-revise]');
    const error = root.querySelector('[data-maint-error]');
    let current = null, ready = false;
    function notify(text, failed = false) {
      const box = root.querySelector('#admin-feedback');
      box.hidden = false; box.textContent = text; box.setAttribute('role',failed?'alert':'status'); box.focus();
    }
    async function load() {
      const invalid = dateFilters.validate();
      if(invalid) { status.textContent = invalid; return; }
      status.textContent = 'Cargando registros…';
      const result = await service.list(Object.fromEntries(new FormData(filter)));
      if(life.signal.aborted) return;
      if(result.status !== 'ready') { status.textContent = textOf(result.status); return; }
      if(!ready) { MaintenanceViews.fillForms(root,result.gardens); ready = true; }
      MaintenanceViews.rows(root.querySelector('[data-maint-rows]'),result.items);
      status.textContent = result.gardens.length ? `${result.total} registros.` : 'Tu cuenta no tiene huertos asignados.';
      root.querySelector('[data-maint-create] button').disabled = !result.gardens.length;
    }
    async function open(id) {
      const result = await service.detail(id);
      if(result.status !== 'ready') { notify(textOf(result.status),true); return; }
      current = result.record;
      MaintenanceViews.history(root.querySelector('[data-maint-history]'),result.record,result.revisions);
      revise.reset(); error.hidden = true;
      revise.hidden = result.record.state === 'voided';
      revise.elements.task.value = result.record.type;
      dialog.showModal();
    }
    root.addEventListener('click',event => {
      const opener = event.target.closest('[data-maint-open]');
      if(opener) open(opener.dataset.maintOpen);
    },{signal:life.signal});
    root.querySelectorAll('[data-maint-close]').forEach(button => button.addEventListener('click',() => dialog.close(),{signal:life.signal}));
    filter.addEventListener('change',load,{signal:life.signal});
    filter.addEventListener('submit',event => { event.preventDefault(); load(); },{signal:life.signal});
    root.querySelector('[data-maint-create]').addEventListener('submit',async event => {
      event.preventDefault();
      const values = new FormData(event.target);
      const result = await service.create(Number(values.get('garden')),values.get('task'));
      if(result.status === 'accepted') { notify('Intervención registrada.'); load(); } else notify(textOf(result.status),true);
    },{signal:life.signal});
    revise.addEventListener('submit',async event => {
      event.preventDefault();
      const reason = revise.elements.reason.value.trim();
      if(!reason) { error.textContent = 'Escribe el motivo.'; error.hidden = false; return; }
      const voiding = event.submitter?.value === 'void';
      const result = voiding ? await service.void(current.id,reason,current.revision)
        : await service.correct(current.id,revise.elements.task.value,reason,current.revision);
      if(result.status === 'accepted') { dialog.close(); notify(voiding?'Registro anulado.':'Corrección guardada.'); load(); return; }
      error.textContent = textOf(result.status); error.hidden = false;
      if(result.status === 'stale') { dialog.close(); notify(textOf('stale'),true); load(); }
    },{signal:life.signal});
    load();
    return {dispose(){life.abort(); if(dialog.open) dialog.close();}};
  }
  return {mount};
})();
