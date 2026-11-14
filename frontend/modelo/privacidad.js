// Documentos legales y secciones que cuentan las estadísticas. La autoridad es del servidor.
const PrivacyModel = (() => {
  const documents = Object.freeze({
    terminos: Object.freeze({title:'Términos y condiciones', state:'pending', version:null}),
    privacidad: Object.freeze({title:'Aviso de privacidad', state:'pending', version:null}),
    cookies: Object.freeze({title:'Política de cookies', state:'pending', version:null})
  });
  // Pantallas a las que «Volver» no debe llevar: otro documento o un paso de acceso a medias.
  // Lista cerrada: cualquier otra pantalla, incluida la administración, no se cuenta.
  function sectionOf(route) {
    if(route.screen === 'cuenta') return route.detail === 'privacidad' ? 'privacidad' : route.detail ? null : 'cuenta';
    if(route.screen === 'inicio') return {'el-proyecto':'proyecto',prototipo:'prototipo','como-funciona':'funcionamiento'}[route.anchor] || 'inicio';
    return {huerto:'huerto',telemetria:'panel_tecnico',mantenimiento:'mantenimiento',soporte:'soporte',avisos:'avisos'}[route.screen] || null;
  }
  return Object.freeze({sectionOf,documents});
})();
