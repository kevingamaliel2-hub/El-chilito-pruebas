// Aviso de cookies, ventana de preferencias y confirmación. Solo contenido fijo: ningún dato del servidor.
const CookieViews = (() => {
  const button = (action,label,type='button') => `<button class="cookies-boton" type="${type}"${action ? ` data-cookies-accion="${action}"` : ''}>${label}</button>`;
  const error = () => '<p class="cookies-error" data-cookies-error role="alert" hidden></p>';
  const markup = `<div class="cookies-aviso" data-cookies-aviso role="region" aria-labelledby="cookies-aviso-titulo" hidden>
      <div class="cookies-aviso-texto">
        <h2 id="cookies-aviso-titulo">Tu privacidad y las cookies</h2>
        <p>Usamos cookies necesarias para mantener tu sesión, proteger tus acciones y recordar tus preferencias. Si lo autorizas, también utilizaremos cookies para obtener estadísticas internas de navegación y mejorar la web. Puedes rechazar estas estadísticas y seguir utilizando el sitio.</p>
        <a class="cookies-enlace" href="#cookies">Leer la política de cookies</a>
        ${error()}
      </div>
      <div class="cookies-acciones">${button('aceptar','Aceptar')}${button('rechazar','Rechazar')}${button('configurar','Configurar')}</div>
    </div>
    <dialog class="cookies-panel" data-cookies-panel aria-labelledby="cookies-panel-titulo" aria-describedby="cookies-panel-texto">
      <form data-cookies-form>
        <h2 id="cookies-panel-titulo">Configurar cookies</h2>
        <p id="cookies-panel-texto">Elige si quieres permitir las estadísticas opcionales. Puedes cambiar tu decisión cuando quieras desde «Configurar cookies», al pie de la página.</p>
        <button class="cookies-cerrar" type="button" data-cookies-accion="cerrar" aria-label="Cerrar sin guardar">${icon('close')}</button>
        <section class="cookies-categoria" aria-labelledby="cookies-necesarias">
          <div class="cookies-categoria-fila">
            <div><h3 id="cookies-necesarias">Cookies necesarias</h3>
            <p>Permiten mantener tu sesión, proteger las solicitudes que haces a la web y recordar tu elección de cookies.</p></div>
            <span class="cookies-fijo">Siempre activas</span>
          </div>
          <details class="cookies-detalle"><summary>Ver detalles</summary><ul>
            <li><code>sessionid</code>: mantiene la sesión iniciada.</li>
            <li><code>csrftoken</code>: ayuda a proteger tus acciones frente a solicitudes enviadas desde otros sitios.</li>
            <li><code>chilito_preferencia</code>: recuerda tu elección de cookies durante un máximo de 180 días.</li>
          </ul></details>
        </section>
        <section class="cookies-categoria" aria-labelledby="cookies-estadisticas">
          <div class="cookies-categoria-fila">
            <div><h3 id="cookies-estadisticas">Estadísticas opcionales</h3>
            <p id="cookies-estadisticas-texto">Nos ayudan a conocer cuántas visitas reciben las secciones para mejorar la web. Puedes desactivarlas sin perder acceso a tu cuenta ni a tu huerto.</p></div>
            <label class="cookies-interruptor"><input type="checkbox" role="switch" name="statistics" aria-labelledby="cookies-estadisticas" aria-describedby="cookies-estadisticas-texto"><span></span></label>
          </div>
          <details class="cookies-detalle"><summary>Ver detalles</summary>
            <p>Utilizan la cookie <code>chilito_estadistica</code>, con una duración máxima de 30 minutos. Los totales de visitas no incluyen tu nombre ni tu correo electrónico.</p>
          </details>
        </section>
        ${error()}
        <div class="cookies-acciones cookies-acciones--panel">${button('','Guardar preferencias','submit')}${button('rechazar','Rechazar estadísticas')}</div>
      </form>
    </dialog>
    <div class="cookies-confirmacion" data-cookies-confirmacion role="status" tabindex="-1" hidden></div>`;
  return Object.freeze({
    root() {
      const node = document.createElement('div');
      node.className = 'cookies';
      node.innerHTML = markup;
      return node;
    },
    busy(root, busy) {
      root.toggleAttribute('aria-busy',busy);
      root.querySelectorAll('button,input').forEach(control => { control.disabled = busy; });
    }
  });
})();
