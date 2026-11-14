// Pantalla de mantenimientos. Datos del servidor solo por textContent y value.
const MaintenanceViews = (() => {
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };
  const options = (select, entries, blank) => {
    select.replaceChildren(...(blank ? [el('option',{value:'',textContent:blank})] : []),
      ...entries.map(([value,label]) => el('option',{value:String(value),textContent:label})));
  };
  const taskEntries = () => Object.entries(MaintenanceService.tasks);
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const weekdays = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  function dateField(name, label) {
    return `<div class="maint-date-control"><label for="maint-${name}">${label}</label>
      <div class="maint-date-field"><input type="text" name="${name}" id="maint-${name}" placeholder="aaaa-mm-dd" maxlength="10" autocomplete="off" spellcheck="false" aria-describedby="maint-date-format">
      <button type="button" data-date-open="${name}" aria-label="Abrir calendario: ${label}" aria-controls="maint-calendar" aria-expanded="false" aria-haspopup="dialog">${icon('calendar')}</button></div></div>`;
  }
  function shell() {
    return `${AppViews.heading('Mantenimientos','Registra, corrige y anula intervenciones de los huertos asignados.')}
      <div id="admin-feedback" class="user-feedback" role="status" tabindex="-1" hidden></div>
      <section class="bento-panel" aria-labelledby="mant-alta"><h2 id="mant-alta">Registrar intervención</h2>
        <form data-maint-create class="maint-form"><label>Huerto<select name="garden" required></select></label>
        <label>Tipo<select name="task" required></select></label>
        <button class="button btn-liquid-brand" type="submit">Registrar</button></form></section>
      <section class="bento-panel" aria-labelledby="mant-lista"><h2 id="mant-lista">Registros</h2>
        <form data-maint-filter class="maint-form"><label>Huerto<select name="garden"></select></label>
        <label>Estado<select name="state"><option value="">Todos</option><option value="active">Vigentes</option><option value="voided">Anulados</option></select></label>
        <label>Tipo<select name="task"></select></label>
        ${dateField('since','Desde')}${dateField('until','Hasta')}
        <p class="sr-only" id="maint-date-format">Escribe la fecha en formato año-mes-día, por ejemplo 2026-11-07. Usa flecha abajo para abrir el calendario.</p></form>
        <div class="user-table-scroll" tabindex="0" role="region" aria-label="Registros de mantenimiento">
        <table class="user-table admin-table"><thead><tr><th scope="col">Fecha</th><th scope="col">Huerto</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody data-maint-rows></tbody></table></div>
        <p data-maint-status role="status"></p></section>
      <dialog class="bento-panel app-dialog" data-maint-dialog aria-labelledby="mant-dialogo"><h2 id="mant-dialogo">Registro</h2><button class="maint-dialog-close" type="button" data-maint-close aria-label="Cerrar registro">${icon('close')}</button>
        <div data-maint-history></div>
        <form data-maint-revise><label data-maint-task>Tipo correcto<select name="task"></select></label>
        <label>Motivo<textarea name="reason" rows="3" maxlength="500" required></textarea></label>
        <p data-maint-error role="alert" hidden></p>
        <div class="app-actions maint-dialog-actions"><button class="button btn-liquid-brand" type="submit" name="action" value="correct">Guardar corrección</button>
        <button class="button btn-liquid-light" type="button" data-maint-close>Cerrar</button>
        <button class="button btn-liquid-light" type="submit" name="action" value="void" data-danger="true">Anular registro</button></div></form></dialog>`;
  }
  function fillForms(root, gardens) {
    const entries = gardens.map(item => [item.id,item.name]);
    options(root.querySelector('[data-maint-create] [name=garden]'),entries);
    options(root.querySelector('[data-maint-filter] [name=garden]'),entries,'Todos');
    options(root.querySelector('[data-maint-create] [name=task]'),taskEntries());
    options(root.querySelector('[data-maint-filter] [name=task]'),taskEntries(),'Todos');
    options(root.querySelector('[data-maint-revise] [name=task]'),taskEntries());
  }
  function rows(host, items) {
    host.replaceChildren(...items.map(item => {
      const open = el('button',{type:'button',className:'button btn-liquid-light',textContent:'Ver'});
      open.dataset.maintOpen = item.id;
      const when = new Date(item.at).toLocaleString('es-MX');
      return el('tr',{},...[when,item.garden,MaintenanceService.tasks[item.type]||item.type,item.state==='voided'?'Anulado':'Vigente'].map(text=>el('td',{textContent:text})),el('td',{},open));
    }));
  }
  function history(host, record, revisions) {
    const lines = [`Original: ${MaintenanceService.tasks[record.originalType]||record.originalType}`];
    for(const item of revisions) lines.push(`${new Date(item.at).toLocaleString('es-MX')} · ${item.kind==='anulacion'?'Anulación':'Corrección a '+(MaintenanceService.tasks[item.correctedType]||item.correctedType)}: ${item.reason}`);
    host.replaceChildren(el('ol',{className:'user-history-list'},...lines.map(text=>el('li',{textContent:text}))));
  }
  function datePicker() {
    const picker = el('div',{id:'maint-calendar',className:'maint-calendar',hidden:true});
    picker.setAttribute('popover','manual');
    picker.setAttribute('role','dialog');
    picker.setAttribute('aria-labelledby','maint-calendar-title');
    picker.setAttribute('aria-describedby','maint-calendar-help');
    picker.innerHTML = `<div class="maint-calendar-header"><h2 id="maint-calendar-title">Calendario</h2>
      <button type="button" data-date-action="close" aria-label="Cerrar calendario">${icon('close')}</button></div>
      <div class="maint-calendar-navigation"><button type="button" data-date-action="prev" aria-label="Mes anterior">${icon('arrow')}</button>
      <select data-date-month aria-label="Mes"></select><input type="number" data-date-year min="1" max="9999" step="1" aria-label="Año" inputmode="numeric">
      <button type="button" data-date-action="next" aria-label="Mes siguiente">${icon('arrow')}</button></div>
      <h3 id="maint-calendar-month" data-date-heading aria-live="polite" aria-atomic="true"></h3>
      <p id="maint-calendar-help" class="sr-only">Usa las flechas para recorrer los días, Inicio y Fin para la semana, Re Pág y Av Pág para cambiar de mes, y Mayús para cambiar de año. Pulsa Intro para seleccionar y Escape para cerrar.</p>
      <div data-date-grid></div><div class="maint-calendar-footer"><button type="button" data-date-action="today">Hoy</button><button type="button" data-date-action="clear">Limpiar</button></div>`;
    options(picker.querySelector('[data-date-month]'),months.map((month,index)=>[index,month]));
    return picker;
  }
  function renderCalendar(picker, {year,month,days,selected,today,focused}) {
    picker.querySelector('[data-date-month]').value = String(month);
    picker.querySelector('[data-date-year]').value = String(year);
    picker.querySelector('[data-date-heading]').textContent = `${months[month]} de ${year}`;
    picker.querySelector('[data-date-action=prev]').disabled = year === 1 && month === 0;
    picker.querySelector('[data-date-action=next]').disabled = year === 9999 && month === 11;
    const table = el('table',{className:'maint-calendar-grid'});
    table.setAttribute('role','grid');
    table.setAttribute('aria-labelledby','maint-calendar-month');
    const head = el('tr');
    weekdays.forEach((day,index) => {
      const cell = el('th',{scope:'col',textContent:['L','M','X','J','V','S','D'][index]});
      cell.setAttribute('aria-label',day);
      head.append(cell);
    });
    const body = el('tbody');
    days.forEach(week => {
      const row = el('tr');
      week.forEach((date,index) => {
        const cell = el('td');
        cell.setAttribute('role','gridcell');
        if(date) {
          cell.setAttribute('aria-selected',String(date.value === selected));
          const button = el('button',{type:'button',textContent:String(date.day),tabIndex:date.value === focused ? 0 : -1});
          button.dataset.dateValue = date.value;
          button.setAttribute('aria-label',`${weekdays[index]}, ${date.day} de ${months[month].toLowerCase()} de ${year}`);
          if(date.value === today) button.setAttribute('aria-current','date');
          cell.append(button);
        }
        row.append(cell);
      });
      body.append(row);
    });
    table.append(el('thead',{},head),body);
    picker.querySelector('[data-date-grid]').replaceChildren(table);
  }
  return {shell,fillForms,rows,history,datePicker,renderCalendar};
})();
