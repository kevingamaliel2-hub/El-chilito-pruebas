// One router with a server-confirmed session guard.
const SiteController = (() => {
  function start({authService = AuthService, appService = AppService, config = AuthConfig, assets = '', review = false, canEnter = options => authService.restore(options)} = {}) {
    const sections = ['inicio','el-proyecto','prototipo','consiguelo','como-funciona'];
    const app = document.getElementById('app');
    let current = {}, controller = null, authContext = {}, renderId = 0, navigationRequest = null, heroShown = false;
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const replaceHash = hash => history.replaceState(null,'',location.pathname + location.search + hash);
    function routeFromHash() {
      const [path, query = ''] = location.hash.slice(1).split('?');
      const [part, encodedDetail] = path.split('/');
      let detail;
      try { detail = decodeURIComponent(encodedDetail || ''); } catch { detail = ''; }
      if(part==='admin') return {screen:'admin',detail:['flota','soporte','gobernanza','despliegues','mantenimientos','solicitudes','vinculacion','guias'].includes(detail)?detail:'flota'};
      // La pantalla de solicitudes se retiró: el Aviso explica estos derechos y sus medios.
      if(path === 'derechos-arco') { replaceHash('#privacidad'); return {screen:'privacidad'}; }
      if(part === 'cuenta' && detail === 'seguridad') return {screen:'cuenta',detail:'seguridad',invalidSecurity:path.split('/').length !== 2};
      if(part === 'cuenta' && detail === 'privacidad') {
        if(path.split('/').length !== 2) replaceHash('#cuenta/privacidad');
        return {screen:'cuenta',detail:'privacidad'};
      }
      if(part === 'asistente') { history.replaceState(null,'',location.pathname + location.search + '#huerto'); return {screen:'huerto'}; }
      if(part === 'huerto' && detail === 'avisos') {
        history.replaceState(null,'',location.pathname + location.search + '#avisos');
        return {screen:'avisos',detail:''};
      }
      if(part === 'segundo-paso') return {screen:'segundo-paso'};
      if(path === 'sin-acceso') return {screen:'sin-acceso'};
      if(part === 'restablecer') {
        const token = AuthModel.consumeResetLink(location,history);
        if(token) {
          authContext = {resetToken:token};
        }
      }
      if(AuthModel.screens.includes(part)) return {screen:part};
      if(Object.hasOwn(PrivacyModel.documents, part) && !encodedDetail) return {screen:part};
      if(AppModel.destinations.some(item => item.id === part)) return {screen:part,detail};
      return {screen:'inicio',anchor:sections.includes(part) ? part : null};
    }
    // La sesión conocida evita el parpadeo; la del servidor decide. Quien está en el segundo paso no cuenta.
    async function offerAccount(id) {
      const known = authService.session?.status === 'authenticated';
      if(known) showAccountAccess(app,AppModel.panelHome(authService.session));
      let session;
      try { session = await canEnter({}); } catch { return; }
      if(id !== renderId) return;
      if(session?.status === 'authenticated') showAccountAccess(app,AppModel.panelHome(session));
      else if(known) render();
    }
    async function leaveAccessScreen(id) {
      let session;
      try { session = await canEnter({}); } catch { return; }
      if(id !== renderId || session?.status !== 'authenticated') return;
      replaceHash(AppModel.panelHome(session));
      render();
    }
    async function render() {
      const id = ++renderId;
      navigationRequest?.abort();
      navigationRequest = null;
      app.removeAttribute('aria-busy');
      let route = routeFromHash();
      const requestedPrivate = AppModel.isPrivate(route.screen);
      if(requestedPrivate) {
        // Keep the last authorized view and its navigation while checking the next route.
        if(!controller?.update || !AppModel.isPrivate(current.screen)) {
          controller?.dispose(); controller = null;
          app.innerHTML = AuthViews.sessionChecking();
        }
        app.setAttribute('aria-busy','true');
        const guard = new AbortController();
        navigationRequest = guard;
        const timeout = setTimeout(() => guard.abort(), config.requestTimeoutMs);
        let session;
        try { session = await canEnter({signal:guard.signal}); } catch { session = {status:'unavailable'}; }
        finally {
          clearTimeout(timeout);
          if(id === renderId) { navigationRequest = null; app.removeAttribute('aria-busy'); }
        }
        if(id !== renderId) return;
        if(session?.status !== 'authenticated') {
          const verifying = session?.status === 'verification-required';
          const destination = session?.status === 'second-step' ? 'segundo-paso' : verifying ? 'verificar' : 'acceso';
          authContext = verifying ? {email:session.email,expiresAt:AuthModel.expiry(session.expiresAt)} : {feedback:session?.status === 'unavailable' ? 'No podemos comprobar tu sesión. Inténtalo de nuevo.' : 'Inicia sesión para continuar.'};
          history.replaceState(null,'',location.pathname + location.search + '#' + destination);
          route = {screen:destination};
        } else if((session.role==='admin') !== (route.screen==='admin') && !(session.role==='admin' && route.screen==='cuenta')) {
          route=session.role==='admin'?{screen:'admin',detail:AppModel.adminHome(session).split('/')[1]}:{screen:'huerto'};
          history.replaceState(null,'',location.pathname+location.search+'#'+(route.screen==='admin'?'admin/'+route.detail:'huerto'));
        }
        // Sin método fuerte, el servidor niega el panel: se lleva a la pantalla donde activarlo.
        if(session?.status==='authenticated'&&session.profile?.mfaRequired===true&&route.screen==='admin') {
          route={screen:'cuenta',detail:'seguridad',invalidSecurity:false};
          history.replaceState(null,'',location.pathname+location.search+'#cuenta/seguridad');
        }
        if(session?.status==='authenticated'&&route.screen==='admin'&&!AppModel.allowedAdmin(session).some(item=>item.id==='admin/'+route.detail)) {
          route={screen:'admin',detail:AppModel.adminHome(session).split('/')[1]};
          history.replaceState(null,'',location.pathname+location.search+'#admin/'+route.detail);
        }
      }
      if(route.screen === 'verificar' && !authContext.email) {
        let verification;
        try { verification = await authService.verificationContext(); } catch { verification = {status:'unavailable'}; }
        if(id !== renderId) return;
        if(verification.status === 'verification-required') authContext = {email:verification.email,expiresAt:AuthModel.expiry(verification.expiresAt)};
        else {
          authContext = {feedback:'Inicia sesión para continuar la verificación de tu correo.'};
          history.replaceState(null,'',location.pathname + location.search + '#acceso');
          route = {screen:'acceso'};
        }
      }
      const isPrivate = AppModel.isPrivate(route.screen);
      const changed = route.screen !== current.screen || route.detail !== current.detail || route.invalidSecurity !== current.invalidSecurity;
      const sectionChanged = PrivacyModel.sectionOf(route) !== PrivacyModel.sectionOf(current);
      const stayOnLanding = route.screen === 'inicio' && current.screen === 'inicio' && Boolean(app.querySelector('.home'));
      const reuseShell = isPrivate && (route.screen==='admin')===(current.screen==='admin') && Boolean(controller?.update) && AppModel.isPrivate(current.screen);
      if(!reuseShell) { controller?.dispose(); controller = null; }
      const fromAccessScreen = AuthModel.screens.includes(current.screen);
      current = route;
      document.body.dataset.screen = route.screen;
      document.body.dataset.private = String(isPrivate);
      document.body.dataset.role = isPrivate && authService.session?.role==='admin' ? 'admin' : 'user';
      if(route.screen === 'segundo-paso') {
        authContext = {};
        document.title = 'Confirma tu acceso · El Chilito';
        controller = SecondStepController.mount({root:app,assets,async onDone() { const session=await authService.restore(); CookieController.refresh(); location.hash=session.role==='admin'?(session.profile?.mfaRequired?'#cuenta/seguridad':'#'+AppModel.adminHome(session)):'#huerto'; },onCancel() { location.hash='#acceso'; }});
      } else if(AuthModel.screens.includes(route.screen)) {
        document.title = AuthViews.title(route.screen) + ' · El Chilito';
        controller = AuthController.mount(route.screen, {
          root:app, service:authService, config, assets, context:authContext, review,
          onNavigate(screen, context) { authContext = context; location.hash = '#' + screen; },
          async onSessionConfirmed() { authContext = {}; const session=await authService.restore(); CookieController.refresh(); location.hash=session.role==='admin'?'#'+AppModel.adminHome(session):'#huerto'; }
        });
        delete authContext.resetToken;
        // Entre pantallas de acceso el panel de la foto no cambia: solo se anima al llegar.
        if(!fromAccessScreen && !reducedMotion()) revealTitle(app.querySelector('.auth-quote h2'));
        if(['acceso','registro'].includes(route.screen)) leaveAccessScreen(id);
      } else if(route.screen === 'sin-acceso') {
        authContext = {};
        document.title = 'Sin acceso a tu segundo paso · El Chilito';
        app.innerHTML = AuthViews.layout('Sin acceso a tu segundo paso','Si no tienes tu app, tus llaves ni tus códigos, el equipo puede ayudarte. Cambiar la contraseña no quita este paso.',LegalViews.accessHelp(),assets);
        const contact = ChilitoHTTP.configuration?.supportContact;
        if(contact) MfaViews.supportContact(app.querySelector('[data-step-contact]'),MfaService.supportContact(contact));
      } else if(Object.hasOwn(PrivacyModel.documents, route.screen)) {
        authContext = {};
        const legalDocument = PrivacyModel.documents[route.screen];
        document.title = legalDocument.title + ' · El Chilito';
        app.innerHTML = LegalViews.render(legalDocument, route.screen);
        PrivacyData.document(route.screen).then(result => { if(id === renderId) LegalViews.fill(app.querySelector('[data-legal-text]'),result); });
        offerAccount(id);
      } else if(isPrivate) {
        authContext = {};
        document.title = (route.screen==='admin' ? AppModel.adminDestinations.find(item=>item.id==='admin/'+route.detail).label : route.screen === 'cuenta' && route.detail === 'contrasena' ? 'Cambiar contraseña' : route.screen === 'avisos' && route.detail ? 'Detalle del aviso' : AppModel.destinations.find(item=>item.id===route.screen).label) + ' · El Chilito';
        if(route.detail === 'privacidad') document.title = 'Privacidad · El Chilito';
        if(route.detail === 'seguridad') document.title = (route.invalidSecurity?'Página no disponible':'Seguridad') + ' · El Chilito';
        if(reuseShell) controller.update(route);
        else controller = AppController.mount(route, {root:app,service:appService,authService,config,review,onLogout() { CookieController.refresh(); location.hash = '#acceso'; }});
      } else {
        authContext = {};
        document.title = 'Tu huerto de habanero, dentro de casa · El Chilito';
        // Entre secciones de la portada no se reconstruye: el indicador del menú debe poder deslizarse.
        if(!stayOnLanding) {
          app.innerHTML = landing(assets);
          ContactController.mount(app,config);
          offerAccount(id);
          if(!heroShown && !route.anchor && !reducedMotion()) revealTitle(app.querySelector('.hero h1'));
          heroShown = true;
        }
      }
      if(!reuseShell && !stayOnLanding) window.bindNavigation();
      if(sectionChanged) CookieController.visit(route);
      if(changed) { window.scrollTo(0,0); document.getElementById('contenido')?.focus({preventScroll:true}); }
      if(route.anchor && route.anchor !== 'inicio') requestAnimationFrame(() => {
        const target = document.getElementById(route.anchor);
        if(target) { target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView(); }
      });
      else if(route.screen === 'inicio') window.scrollTo(0,0);
    }
    document.querySelector('.skip-link')?.addEventListener('click', event => {
      event.preventDefault(); document.getElementById('contenido')?.focus();
    });
    window.addEventListener('hashchange', render);
    window.addEventListener('pagehide', () => { renderId++; navigationRequest?.abort(); controller?.dispose(); controller = null; });
    ChilitoHTTP.onSessionExpired(() => {
      renderId++; navigationRequest?.abort();
      authService.forgetSession();
      CookieController.refresh();
      authContext = {feedback:'Tu sesión ha vencido. Inicia sesión de nuevo.'};
      if(location.hash === '#acceso') render(); else location.hash = '#acceso';
    });
    window.addEventListener('pageshow', event => { if(event.persisted) render(); });
    render();
    return {refresh:render};
  }
  return {start};
})();
