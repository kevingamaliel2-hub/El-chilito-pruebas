// Buzón de consultas del producto. Solo transporta y adapta datos: la autorización la decide Django.
const InquiryService = (() => {
  const states = Object.freeze({nueva:'Nueva', atendida:'Atendida', archivada:'Archivada'});
  // Estado real del aviso: aceptado por SMTP no significa que llegara a la bandeja.
  const notices = Object.freeze({pendiente:'Aviso pendiente de envío', aceptado_smtp:'Aviso aceptado por el servidor de correo', fallido:'El aviso por correo falló; se reintentará'});
  const statusOf = response => response.http===401?'unauthenticated':response.body?.code==='stale-record'?'stale':response.http===403?'forbidden':response.http===429?'limited':'error';
  async function call(path, options = {}) {
    try {
      const response = await ChilitoHTTP.request('/api/admin/consultas'+path, options);
      if(response.http===401) ChilitoHTTP.sessionExpired();
      return [200,201].includes(response.http) ? response.body : {status:statusOf(response)};
    } catch { return {status:'error'}; }
  }
  return Object.freeze({
    states, notices,
    // En segundo plano se marca como sondeo: el servidor no lo cuenta como actividad de la sesión.
    list(state = '', page = 1, {background = false} = {}) {
      const query = new URLSearchParams({page:String(page)});
      if(Object.hasOwn(states, state)) query.set('state', state);
      return call('?'+query, background ? {headers:{'X-Chilito-Sondeo':'1'}} : {});
    },
    advance(id, state) {
      if(!['atendida','archivada'].includes(state)) return Promise.resolve({status:'invalid'});
      return call('/'+encodeURIComponent(id)+'/estado', {method:'POST', body:{state}});
    },
    // Una archivada puede no haberse respondido: su responsable es el último registro, no «atendida por».
    attentionText(item) {
      if(!item.attendedBy) return 'Sin atender';
      const when = this.dateText(item.attendedAt);
      return item.state === 'atendida' ? `Atendida por ${item.attendedBy} el ${when}` : `Último registro: ${item.attendedBy}, ${when}`;
    },
    // Fecha legible como texto plano: la vista la inserta con textContent.
    dateText(value) {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}) : 'Sin fecha';
    },
    // Responder en Gmail web, en una pestaña nueva y con la cuenta de soporte si está configurada.
    // Es un enlace de redacción: sin API, sin OAuth y sin enviar nada en nombre del panel.
    replyHref(item) {
      const valid = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if(!valid(item.email)) return null;
      const query = new URLSearchParams({view:'cm', fs:'1', to:item.email, su:`Re: [El Chilito] Pregunta sobre el producto (${item.folio})`});
      const account = ChilitoHTTP.configuration?.supportContact;
      if(valid(account)) query.set('authuser', account);
      return 'https://mail.google.com/mail/?'+query;
    }
  });
})();
