// Regresión del modelo y de la separación de capas de las guías de cuidado. No accede a la API real.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = name => fs.readFileSync(`${__dirname}/${name}`, 'utf8');
(async () => {
  const calls = [];
  let reply = {http:200, body:{status:'ready', guides:[]}};
  const context = vm.createContext({URL, ChilitoHTTP:{sessionExpired() { calls.push('expired'); }, async request(path, options) {
    calls.push({path, options});
    if(reply === 'throw') throw new TypeError('network');
    return reply;
  }}});
  vm.runInContext(read('modelo/guias.js'), context);
  const service = vm.runInContext('CareGuideService', context);
  // Enlaces y párrafos.
  for(const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a.test/', 'no-es-url', null, 7]) assert.equal(service.safeUrl(bad), null, String(bad));
  assert.equal(service.safeUrl('https://a.test/x'), 'https://a.test/x');
  assert.deepEqual([...service.paragraphs('Uno\nsigue\n\n  Dos \n \nTres')], ['Uno\nsigue', 'Dos', 'Tres']);
  // Adaptación: el enlace peligroso no llega a la vista y una ficha inválida se descarta.
  reply = {http:200, body:{status:'ready', guides:[
    {key:'a-1', question:'¿A?', answer:'x', source:{name:'F', url:'javascript:alert(1)'}},
    {key:'MAL CLAVE', question:'¿B?', answer:'x', source:null}]}};
  const list = await service.published();
  assert.equal(list.status, 'ready'); assert.equal(list.items.length, 1);
  assert.equal(list.items[0].source.url, null); assert.equal(list.items[0].source.name, 'F');
  // Estados de error.
  for(const [http, code, status] of [[403,'access-denied','forbidden'],[403,'mfa-required','mfa'],[409,'stale-record','stale'],[409,'operation-conflict','conflict'],[429,'rate-limited','limited'],[400,'invalid-input','invalid'],[503,'service-unavailable','error'],[401,'unauthenticated','unauthenticated']]) {
    reply = {http, body:{code}};
    assert.equal((await service.panel()).status, status, code);
  }
  assert.ok(calls.includes('expired'));
  reply = 'throw';
  assert.equal((await service.published()).status, 'network');
  assert.equal((await service.update('x', 1, {question:'a', answer:'b', order:'1', sourceName:'', sourceUrl:''})).status, 'network');
  // Escrituras: rutas, versión y solo los campos del contrato.
  reply = {http:200, body:{status:'accepted'}};
  await service.update('id/1', 3, {question:'q', answer:'a', order:'12', sourceName:'n', sourceUrl:'https://a.test', extra:'no'});
  const sent = calls.at(-1);
  assert.equal(sent.path, '/api/admin/guias/id%2F1/editar');
  assert.deepEqual(Object.keys(sent.options.body).sort(), ['answer','order','question','sourceName','sourceUrl','version']);
  assert.equal(sent.options.body.order, 12); assert.equal(sent.options.body.version, 3);
  // Aviso previo del formulario.
  const base = {question:'q', answer:'a', order:'1', sourceName:'', sourceUrl:''};
  assert.equal(service.check(base), null);
  for(const [change, field] of [[{question:' '},'question'],[{answer:''},'answer'],[{order:'0'},'order'],[{order:'x'},'order'],[{order:'10000'},'order'],[{sourceUrl:'javascript:alert(1)',sourceName:'n'},'sourceUrl'],[{sourceUrl:'https://a.test'},'sourceName']])
    assert.equal(service.check({...base, ...change}).field, field);
  // Sin catálogo paralelo ni HTML con datos del servidor.
  const model = read('modelo/guias.js'), view = read('vista/guias.js'), control = read('controlador/guias.js');
  for(const source of [model, view, control]) for(const question of ['germinar', '¿Para qué sirve', 'goteros', 'flotador']) assert.ok(!source.includes(question), question);
  assert.ok(!/fetch\(|ChilitoHTTP/.test(view));
  assert.ok(!/document\.|querySelector/.test(model));
  assert.ok(!/innerHTML/.test(view));
  assert.ok(!/fetch\(|ChilitoHTTP/.test(control));
  assert.ok(!/<img|data-image|placeholder/i.test(view));
  console.log('PASS guías de cuidado');
})().catch(error => { console.error(error); process.exit(1); });
