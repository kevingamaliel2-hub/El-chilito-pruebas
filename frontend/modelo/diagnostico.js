// Resumen de la tarjeta del huerto: valida lo que envía Django y lo prepara para mostrarlo.
// Aquí no se calculan estados de lectura ni umbrales: esos los decide el servidor.
const GardenDiagnosis = (() => {
  const LIMITS = Object.freeze({title:120, message:600, next:200, explanation:1200});
  const READINGS = new Set(['missing','stale','current']);
  const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F]/;
  const text = (value, max) => {
    if(typeof value !== 'string') return null;
    const clean = value.trim();
    return clean && clean.length <= max && !CONTROL.test(clean) ? clean : null;
  };
  // Formato canónico del contrato: con T y zona horaria. Sin zona, la hora sería ambigua.
  const CANONICAL_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
  const date = value => typeof value === 'string' && CANONICAL_DATE.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const NONE = Object.freeze({status:'unavailable'});
  function adaptExplanation(raw) {
    if(raw === null || raw === undefined) return null;
    if(!isObject(raw)) return NONE;
    if(raw.status === 'expired') return {status:'expired'};
    if(raw.status !== 'available' || raw.source !== 'ai') return NONE;
    const body = text(raw.text, LIMITS.explanation), generatedAt = date(raw.generatedAt), expiresAt = date(raw.expiresAt);
    return body && generatedAt && expiresAt ? {status:'available', text:body, generatedAt, expiresAt} : NONE;
  }
  function adaptReadings(raw) {
    if(!isObject(raw) || !READINGS.has(raw.state)) return null;
    if(raw.state === 'missing') return raw.at === null || raw.at === undefined ? {state:'missing', at:null} : null;
    const at = date(raw.at);
    return at ? {state:raw.state, at} : null;
  }
  // Sin regla ni lecturas válidas no hay resumen. La explicación nunca lo sustituye.
  function adapt(raw) {
    if(!isObject(raw) || !isObject(raw.rule) || raw.rule.source !== 'rules') return null;
    const title = text(raw.rule.title, LIMITS.title), message = text(raw.rule.message, LIMITS.message), generatedAt = date(raw.rule.generatedAt);
    const hasNext = raw.rule.next !== null && raw.rule.next !== undefined, next = hasNext ? text(raw.rule.next, LIMITS.next) : null;
    const readings = adaptReadings(raw.readings);
    if(!title || !message || !generatedAt || !readings || (hasNext && !next)) return null;
    return {rule:{title, message, next, generatedAt}, readings, explanation:adaptExplanation(raw.explanation)};
  }
  const dateText = value => new Date(value).toLocaleString('es-MX', {dateStyle:'medium', timeStyle:'short'});
  function readingsText({state, at}) {
    if(state === 'missing') return 'Sin lecturas disponibles: no se puede valorar el estado de las plantas.';
    if(state === 'stale') return `Lecturas antiguas, la última es del ${dateText(at)}: pueden no describir el estado actual.`;
    return `Lecturas del ${dateText(at)}`;
  }
  // La vigencia se vuelve a comprobar al mostrar: la página puede llevar tiempo abierta.
  function explanationView(explanation, now) {
    if(!explanation) return null;
    if(explanation.status === 'unavailable') return {state:'unavailable', note:'Explicación adicional no disponible.'};
    if(explanation.status === 'expired' || Date.parse(explanation.expiresAt) <= now) return {state:'expired', note:'La explicación adicional caducó y ya no se muestra.'};
    return {state:'available', text:explanation.text, note:`Explicación generada con IA · ${dateText(explanation.generatedAt)} · Complementa el resumen, no lo sustituye.`};
  }
  function present(diagnosis, now = Date.now()) {
    if(!diagnosis) return null;
    return {title:diagnosis.rule.title, message:diagnosis.rule.message, next:diagnosis.rule.next,
      origin:`Resumen por reglas · ${dateText(diagnosis.rule.generatedAt)}`, readings:readingsText(diagnosis.readings),
      explanation:explanationView(diagnosis.explanation, now)};
  }
  function msUntilExpiry(diagnosis, now = Date.now()) {
    if(diagnosis?.explanation?.status !== 'available') return null;
    const left = Date.parse(diagnosis.explanation.expiresAt) - now;
    return left > 0 ? left : null;
  }
  return Object.freeze({adapt, present, msUntilExpiry});
})();
