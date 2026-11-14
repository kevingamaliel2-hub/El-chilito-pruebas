const ProfileViews = (() => {
  const fields = `<label>Nombre<input name="firstName" maxlength="150" autocomplete="given-name"></label>
    <label>Apellido<input name="lastName" maxlength="150" autocomplete="family-name"></label>
    <label>Alias<input name="alias" maxlength="64" autocomplete="nickname" aria-describedby="alias-ayuda"><small id="alias-ayuda">Lo usaremos para dirigirnos a ti.</small></label>`;
  const labels = Object.freeze({firstName:'Nombre',lastName:'Apellido',alias:'Alias'});
  return Object.freeze({
    form: `<section class="bento-panel account-profile" aria-labelledby="perfil-titulo"><h2 id="perfil-titulo">Datos personales</h2>
      <p>Son opcionales y puedes cambiarlos cuando quieras.</p>
      <div data-profile-view><dl class="profile-facts" data-profile-facts></dl>
      <div class="app-actions"><button class="button btn-liquid-light" type="button" data-profile-edit>Cambiar datos</button></div></div>
      <form data-profile class="maint-form" hidden>${fields}
      <div class="app-actions"><button class="button btn-liquid-brand" type="submit">Guardar cambios</button>
      <button class="button btn-liquid-light" type="button" data-profile-cancel>Cancelar</button></div></form>
      <p data-profile-state role="status" hidden></p></section>`,
    // Datos de la persona: siempre como texto.
    facts(host, data) {
      host.replaceChildren(...Object.entries(labels).map(([key,label]) => {
        const row = document.createElement('div');
        row.append(Object.assign(document.createElement('dt'),{textContent:label}),Object.assign(document.createElement('dd'),{textContent:data[key] || 'Sin dato'}));
        return row;
      }));
    },
    welcome: `<dialog class="bento-panel app-dialog" data-welcome aria-labelledby="bienvenida-titulo"><h2 id="bienvenida-titulo">Te damos la bienvenida</h2>
      <p>¿Cómo quieres que te llamemos? Usaremos tu alias para dirigirnos a ti. Todos los datos son opcionales.</p>
      <form data-welcome-form method="dialog" class="maint-form">${fields}<p data-profile-state role="alert" hidden></p>
      <div class="app-actions"><button class="button btn-liquid-light" type="button" data-welcome-skip>Ahora no</button>
      <button class="button btn-liquid-brand" type="submit">Guardar</button></div></form></dialog>`,
    myPrivacy: `<section class="bento-panel privacy-panel" aria-labelledby="mis-datos-titulo"><div class="privacy-panel-row"><div><h2 id="mis-datos-titulo">Mis datos</h2>
      <p>Consulta los datos de tu cuenta. Para corregirlos, usa el apartado Perfil.</p></div>
      <button class="button btn-liquid-brand" type="button" data-my-data>Consultar mis datos</button></div>
      <p data-privacy-state role="status" hidden></p><dl class="profile-facts" data-my-data-list hidden></dl></section>
      <section class="bento-panel privacy-panel" aria-labelledby="estadisticas-titulo"><h2 id="estadisticas-titulo">Estadísticas de este navegador</h2>
      <p>Son voluntarias y solo cuentan secciones visitadas. Los totales ya acumulados no permiten localizar una aportación individual.</p>
      <p class="privacy-saved"><span>Decisión guardada:</span> <strong data-statistics-saved>Consultando…</strong></p>
      <form data-statistics-form><fieldset class="privacy-choice"><legend>Tu selección</legend>
      <label class="cookie-option"><input type="radio" name="statistics" value="yes"> Permitir estadísticas en este navegador</label>
      <label class="cookie-option"><input type="radio" name="statistics" value="no"> No permitir estadísticas</label></fieldset>
      <p class="privacy-unsaved" data-statistics-pending hidden>Tienes un cambio sin guardar.</p>
      <div class="app-actions"><button class="button btn-liquid-brand" type="submit" disabled>Guardar preferencias</button></div>
      <p data-statistics-result role="status" hidden></p></form></section>`
  });
})();
