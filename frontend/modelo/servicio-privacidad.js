// Datos de privacidad reales. Lo automático se marca como sondeo: no alarga la sesión.
const PrivacyData = (() => {
  const background = {'X-Chilito-Sondeo':'1'};
  async function send(path, options = {}) {
    try {
      const response = await ChilitoHTTP.request(path, options);
      if(response.http === 401) return {status:'unauthenticated'};
      if(response.http === 429) return {status:'limited'};
      if(![200,201].includes(response.http)) return {status:'unavailable'};
      return response.body;
    } catch { return {status:'unavailable'}; }
  }
  const post = (path, body, headers = {}) => send(path, {method:'POST', body, headers});
  return Object.freeze({
    cookies: () => send('/api/privacidad/cookies', {headers:background}),
    decide: statistics => post('/api/privacidad/cookies', {statistics}, background),
    section: section => post('/api/estadisticas/seccion', {section}, background),
    document: kind => send('/api/privacidad/documentos/'+encodeURIComponent(kind), {headers:background}),
    myData: () => post('/api/privacidad/mis-datos', {}),
    saveProfile: values => post('/api/cuenta/perfil', values),
    welcome: values => post('/api/cuenta/bienvenida', values)
  });
})();
