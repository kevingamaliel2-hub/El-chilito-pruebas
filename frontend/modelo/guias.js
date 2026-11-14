// Guías de cuidado: transporte y adaptación. El contenido vive en PostgreSQL; aquí no hay otro catálogo.
// Validar, autorizar y publicar lo decide el servidor.
const CareGuideService = (() => {
  // Identificador estable de la ficha a la que apunta «Ver guía de cuidado». No es contenido.
  const SUBSTRATE_KEY = 'sustrato-perlita';
  const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const LIMITS = Object.freeze({question:200, answer:4000, sourceName:120, sourceUrl:500, order:9999});
  const stateLabels = Object.freeze({borrador:'Borrador', publicada:'Publicada', retirada:'Retirada'});
  const statusOf = response => response.http===401?'unauthenticated'
    :response.body?.code==='stale-record'?'stale'
    :response.body?.code==='mfa-required'?'mfa'
    :response.http===403?'forbidden':response.http===429?'limited':response.http===400?'invalid':response.http===409?'conflict':'error';
  async function call(path, options = {}) {
    try {
      const response = await ChilitoHTTP.request(path, options);
      if(response.http===401) ChilitoHTTP.sessionExpired();
      return response.http===200 ? response.body : {status:statusOf(response)};
    } catch { return {status:'network'}; }
  }
  // Segunda comprobación del enlace antes de convertirlo en href: solo http y https.
  function safeUrl(value) {
    if(typeof value !== 'string') return null;
    try { return ['http:','https:'].includes(new URL(value).protocol) ? value : null; } catch { return null; }
  }
  const paragraphs = text => String(text ?? '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const text = value => typeof value === 'string' ? value : '';
  function adaptPublished(raw) {
    if(!raw || !KEY.test(raw.key) || !text(raw.question) || !text(raw.answer)) return null;
    const name = text(raw.source?.name);
    return {key:raw.key, question:raw.question, paragraphs:paragraphs(raw.answer), source:name ? {name, url:safeUrl(raw.source.url)} : null};
  }
  function dateText(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}) : 'Sin fecha';
  }
  // Aviso antes de enviar. El servidor vuelve a validar todo.
  function check(values) {
    if(!values.question.trim()) return {field:'question', message:'Escribe la pregunta.'};
    if(!values.answer.trim()) return {field:'answer', message:'Escribe la respuesta.'};
    if(!/^[0-9]{1,4}$/.test(values.order) || Number(values.order) < 1) return {field:'order', message:'El orden debe ser un número entero de 1 a 9999.'};
    const url = values.sourceUrl.trim();
    if(url && !/^https?:\/\//.test(url)) return {field:'sourceUrl', message:'El enlace debe empezar por http:// o https://.'};
    if(url && !safeUrl(url)) return {field:'sourceUrl', message:'Revisa el enlace de la fuente.'};
    if(url && !values.sourceName.trim()) return {field:'sourceName', message:'Indica el nombre de la fuente del enlace.'};
    return null;
  }
  const payload = values => ({question:values.question, answer:values.answer, order:Number(values.order), sourceName:values.sourceName, sourceUrl:values.sourceUrl});
  const editorTexts = Object.freeze({
    nueva:{title:'Nueva ficha', save:'Guardar como borrador', hint:'Se guardará como borrador. Nadie la verá hasta que pulses «Publicar» en la lista.'},
    borrador:{title:'Editar borrador', save:'Guardar como borrador', hint:'Sigue siendo un borrador. Nadie la verá hasta que pulses «Publicar» en la lista.'},
    publicada:{title:'Editar ficha publicada', save:'Guardar y actualizar lo publicado', hint:'Esta ficha está publicada: al guardar, los cambios serán visibles de inmediato para las personas usuarias.'},
    retirada:{title:'Editar ficha retirada', save:'Guardar (sigue retirada)', hint:'Guardar no la publica. Para mostrarla de nuevo, usa «Volver a publicar» en la lista.'}});
  const id = value => encodeURIComponent(value);
  return Object.freeze({
    SUBSTRATE_KEY, LIMITS, stateLabels, editorTexts, safeUrl, paragraphs, dateText, check,
    async published({signal} = {}) {
      const result = await call('/api/guias', {signal});
      if(result.status !== 'ready' || !Array.isArray(result.guides)) return {status:result.status === 'ready' ? 'error' : result.status};
      return {status:'ready', items:result.guides.map(adaptPublished).filter(Boolean)};
    },
    panel: () => call('/api/admin/guias'),
    create: values => call('/api/admin/guias', {method:'POST', body:payload(values)}),
    update: (guideId, version, values) => call('/api/admin/guias/'+id(guideId)+'/editar', {method:'POST', body:{...payload(values), version}}),
    publish: (guideId, version) => call('/api/admin/guias/'+id(guideId)+'/publicar', {method:'POST', body:{version}}),
    withdraw: (guideId, version) => call('/api/admin/guias/'+id(guideId)+'/retirar', {method:'POST', body:{version}})
  });
})();
