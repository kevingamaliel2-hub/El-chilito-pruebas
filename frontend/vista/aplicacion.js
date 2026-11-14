const AppViews = (() => {
  const escape = authEscape;
  const date = value => `<time${value && Number.isFinite(new Date(value).getTime()) ? ` datetime="${escape(new Date(value).toISOString())}"` : ''}>${escape(AppModel.date(value))}</time>`;
  const heading = (title,intro='') => `<div class="page-heading"><div><h1>${escape(title)}</h1>${intro?`<p>${escape(intro)}</p>`:''}</div></div>`;
  const state = (title,text,loading=false,retry=false) => `<div class="app-state bento-panel" role="${retry?'alert':'status'}"${loading?' aria-busy="true"':''}><span class="icon-medallion">${icon(loading?'clock':'info')}</span><h2>${escape(title)}</h2><p>${escape(text)}</p>${retry?'<button class="button btn-liquid-brand" type="button" data-app-action="reload">Reintentar</button>':''}</div>`;
  const logoutConfirmation = () => `<dialog class="bento-panel app-dialog logout-dialog" aria-labelledby="logout-title" aria-describedby="logout-description"><h2 id="logout-title">¿Cerrar sesión?</h2><p id="logout-description">Tendrás que iniciar sesión de nuevo para entrar a tu cuenta.</p><p class="logout-error" role="alert" tabindex="-1" hidden></p><div class="app-dialog-actions"><button class="button btn-liquid-light" type="button" data-app-action="cancel-logout" autofocus>Cancelar</button><button class="button btn-liquid-brand" type="button" data-app-action="confirm-logout">Cerrar sesión</button></div></dialog>`;
  // Sin huerto: formulario «Vincular mi huerto». La confirmación llega siempre del servidor.
  const gardenLink = () => BindingViews.userPanel();
  const accountGreeting = greeting => greeting?(greeting==='Bienvenido'?greeting:'Hola, '+greeting):'Tu información de acceso.';
  function shell(route) {
    const isAdmin=route.screen==='admin'||AuthService.session?.role==='admin';
    const account=AppModel.destinations.find(item=>item.id==='cuenta');
    const links=isAdmin?[...AppModel.allowedAdmin(),account]:AppModel.destinations.filter(item=>item.id!=='avisos');
    const selected=route.screen==='admin'?'admin/'+route.detail:route.screen;
    const link=item=>`<a class="button btn-liquid-sidebar" href="#${item.id}"${selected===item.id?' aria-current="page"':''}>${icon(item.icon)}<span>${item.label}</span></a>`;
    const accountLink=`<a class="button compact btn-liquid-nav account-icon-link" href="#cuenta" aria-label="Mi cuenta" title="Mi cuenta">${icon('user')}</a>`;
    // Encabezado limpio en ambos roles: a la portada se vuelve con el logotipo.
    const noticesLink=`<a class="button compact btn-liquid-nav account-icon-link" href="#avisos" aria-label="Avisos" title="Avisos"${selected==='avisos'?' aria-current="page"':''}>${icon('bell')}</a>`;
    const menuButton=`<button class="button compact btn-liquid-nav private-menu-toggle" type="button" data-app-action="toggle-menu" aria-controls="garden-navigation" aria-expanded="false" aria-label="Abrir menú de navegación"><span class="private-menu-open-icon">${icon('menu')}</span><span class="private-menu-close-icon">${icon('close')}</span><span>Menú</span></button>`;
    // Sin barra superior: logotipo y botón de ocultar viven en el panel; perfil, avisos (solo usuario) y menú flotan arriba.
    const topbar=`<div class="private-topbar"><div class="topbar-start">${brand('#inicio','El Chilito, inicio','topbar-brand')}</div><div class="topbar-actions">${accountLink}${isAdmin?'':noticesLink}${menuButton}</div></div>`;
    const sidebarTop=`<div class="sidebar-top">${brand('#inicio','El Chilito, inicio','sidebar-brand')}</div><a class="sidebar-home" href="#inicio">${icon('home')}<span>Ver página principal</span></a>${isAdmin?'<p class="private-role-label">Administración</p>':''}`;
    // Enlace externo: abre otra pestaña y el panel sigue abierto. Si no hay correo configurado, no se muestra.
    const mailLink=()=>{const url=AppModel.supportMailUrl();return url?`<a class="private-mail-link" href="${authEscape(url)}" target="_blank" rel="noopener noreferrer">${icon('mail')}<span>Abrir correo de soporte</span>${icon('external')}<span class="sr-only">(se abre en otra pestaña)</span></a>`:'';};
    // Grupo «Gestión»: correo de soporte y buzón de consultas (este solo con atender_consultas).
    const inbox=links.find(item=>item.id==='admin/solicitudes');
    const binding=links.find(item=>item.id==='admin/vinculacion');
    const guides=links.find(item=>item.id==='admin/guias');
    const adminGroup=isAdmin?`<p class="private-role-label private-group-label">Gestión</p><div class="private-pending">${mailLink()}${inbox?link(inbox):''}${binding?link(binding):''}${guides?link(guides):''}</div>`:'';
    // En administración, el grupo «Gestión» va antes de Mi cuenta, que queda al pie del panel.
    const navigation=isAdmin?links.filter(item=>item!==account&&item!==inbox&&item!==binding&&item!==guides).map(link).join('')+adminGroup+link(account):links.map(link).join('');
    // La página principal ya tiene acceso fijo bajo el logotipo, también en móvil.
    const menuFooter=`<div class="private-menu-footer"><button class="button private-menu-logout" type="button" data-app-action="logout">${icon('logout')}<span>Cerrar sesión</span></button></div>`;
    return `<div class="private-layout"><aside class="sidebar" id="garden-navigation">${sidebarTop}<nav class="private-nav" aria-label="Navegación de la aplicación">${navigation}</nav>${menuFooter}</aside><div class="private-content">${topbar}<main class="dashboard container" id="contenido" tabindex="-1"><div id="app-feedback" role="status" tabindex="-1" hidden></div><div id="app-page"></div></main></div></div><div class="private-menu-shade" data-app-action="close-menu" aria-hidden="true" hidden></div>${logoutConfirmation()}`;
  }
  function noticeCard(item) {
    const importance={high:'Alta',medium:'Media',info:'Informativa'}[item.importance];
    return `<article class="bento-panel notice-card" data-notice-id="${escape(item.id)}"><div class="notice-meta"><span class="notice-condition ${item.condition}">${item.condition==='active'?'Activo':'Resuelto'}</span><span class="read-state">${item.read?'Leído':'No leído'}</span></div><h2>${escape(item.title)}</h2><p>${escape(item.description)}</p><dl class="notice-facts"><div><dt>Zona</dt><dd>${escape(item.zone)}</dd></div><div><dt>Importancia</dt><dd>${importance}</dd></div><div><dt>Fecha</dt><dd>${date(item.createdAt)}</dd></div></dl><a class="button btn-liquid-light" href="#avisos/${encodeURIComponent(item.id)}">Ver detalle<span class="sr-only">: ${escape(item.title)}</span></a></article>`;
  }
  function notices(data, filter='all', detail=null, name='') {
    if(data.status==='unassigned')return heading('Avisos')+state('Sin huerto asignado','Tu cuenta todavía no tiene un huerto asignado.');
    if(detail) {
      const item=data.items.find(item=>item.id===detail);
      if(data.status==='loading')return heading('Avisos')+state('Cargando aviso','Consultando su información.',true);
      if(data.status==='error')return heading('Avisos')+state('No se pudo consultar el aviso','Inténtalo de nuevo.',false,true);
      if(!item)return heading('Aviso no disponible')+`<div class="bento-panel"><p>Este aviso no está disponible.</p><a class="button btn-liquid-light" href="#avisos">Todos los avisos</a></div>`;
      return heading('Detalle del aviso')+`<article class="bento-panel notice-detail"><div class="notice-meta"><span class="notice-condition ${item.condition}">${item.condition==='active'?'Activo':'Resuelto'}</span><span class="read-state">${item.read?'Leído':'No leído'}</span></div><h2>${escape(item.title)}</h2><p>${escape(item.description)}</p><dl class="notice-facts"><div><dt>Zona</dt><dd>${escape(item.zone)}</dd></div><div><dt>Importancia</dt><dd>${{high:'Alta',medium:'Media',info:'Informativa'}[item.importance]}</dd></div><div><dt>Fecha</dt><dd>${date(item.createdAt)}</dd></div>${item.resolvedAt?`<div><dt>Resolución</dt><dd>${date(item.resolvedAt)}</dd></div>`:''}</dl><div class="notice-recommendation"><h3>Recomendación</h3><p>${escape(item.recommendation)}</p></div><div class="app-actions">${!item.read?`<button class="button btn-liquid-brand" data-app-action="mark-read" data-id="${escape(item.id)}" type="button">Marcar como leído</button>`:''}<a class="button btn-liquid-light" href="#avisos">Todos los avisos</a></div></article>`;
    }
    const filters=`<div class="notice-filters" role="group" aria-label="Filtrar avisos">${[['all','Todos'],['active','Activos'],['resolved','Resueltos']].map(([id,label])=>`<button class="button ${filter===id?'btn-liquid-brand':'btn-liquid-light'}" type="button" data-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div>`;
    const items=AppModel.filterNotices(data.items,filter);
    let body;
    if(data.status==='loading')body=state('Cargando avisos','Consultando los avisos del huerto.',true);
    else if(data.status==='error')body=state('No se pudieron consultar los avisos','Inténtalo de nuevo para revisar los avisos.',false,true);
    else if(!items.length)body=state(filter==='all'?'No hay avisos para mostrar':'No hay avisos en este filtro','Los avisos de cultivo y comunicación aparecerán aquí cuando estén disponibles.');
    else body=`<div class="notices-grid">${items.map(noticeCard).join('')}</div>`;
    return heading('Avisos',AppModel.addressed(name,'Revisa lo que necesita atención en tu huerto.'))+filters+`<p class="sr-only" role="status">${data.status==='ready'?`${items.length} avisos en este filtro.`:''}</p>`+body;
  }
  // Salida al pie de Mi cuenta. Sigue disponible aunque el perfil no haya podido cargarse.
  const signOut = () => `<section class="bento-panel account-session" aria-labelledby="session-title"><div><h2 id="session-title">Tu sesión</h2><p>Saldrás de tu cuenta en este navegador.</p></div><button class="button btn-liquid-light account-logout" type="button" data-app-action="logout">${icon('logout')}<span>Cerrar sesión</span></button></section>`;
  function account(data) {
    const privacyLink = '<nav class="account-tabs" aria-label="Apartados de mi cuenta"><a class="button btn-liquid-brand active" href="#cuenta" aria-current="page">Perfil</a><a class="button btn-liquid-light" href="#cuenta/seguridad">Seguridad</a><a class="button btn-liquid-light" href="#cuenta/privacidad">Privacidad</a></nav>';
    if(data.status==='loading')return heading('Mi cuenta')+privacyLink+state('Cargando cuenta','Consultando la información de tu cuenta.',true)+signOut();
    if(data.status==='error')return heading('Mi cuenta')+privacyLink+state('No se pudo consultar tu cuenta','Inténtalo de nuevo.',false,true)+signOut();
    return heading('Mi cuenta',accountGreeting(data.greeting))+privacyLink+`<section class="bento-panel account-profile" aria-labelledby="profile-title"><span class="icon-medallion">${icon('user')}</span><h2 id="profile-title">Datos de la cuenta</h2><dl class="profile-facts"><div><dt>Correo electrónico</dt><dd>${data.email?escape(data.email):'Esperando información de la cuenta'}</dd></div><div><dt>Verificación del correo</dt><dd>${data.verified===true?'Correo verificado':data.verified===false?'Correo sin verificar':'Sin información disponible'}</dd></div></dl><div class="app-actions"><a class="button btn-liquid-brand" href="#cuenta/contrasena">Cambiar contraseña</a></div></section><div data-profile-form></div>${signOut()}`;
  }
  return {shell,heading,state,date,notices,account,accountGreeting,gardenLink,
    assistant(){return heading('Asistente')+`<section class="bento-panel assistant-panel" aria-label="Disponibilidad del asistente"><span class="icon-medallion">${icon('sparkle')}</span><p>Aquí podrás consultar orientación para cuidar tu huerto y comprender sus avisos. La asistencia con inteligencia artificial se incorporará en una próxima etapa.</p></section>`;},
    reading(raw,unit){return `<strong class="${raw.value==null?'absent':''}">${raw.value==null?'—':escape(AppModel.number(raw.value))}${raw.value==null?'':`<small>${unit}</small>`}</strong>`;},
    readingNote(raw){return raw.quality==='invalid'?'Lectura inválida. Revisa este sensor.':raw.value==null?'Aún no hay lecturas disponibles.':`Última lectura: ${date(raw.at)}`;}
  };
})();
