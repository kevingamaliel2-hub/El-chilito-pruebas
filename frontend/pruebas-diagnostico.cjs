// Regresión del adaptador de la tarjeta del huerto y de sus etiquetas. No accede a la API real.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = name => fs.readFileSync(`${__dirname}/${name}`, 'utf8');
const context = vm.createContext({});
vm.runInContext(read('modelo/diagnostico.js'), context);
const D = vm.runInContext('GardenDiagnosis', context);
const NOW = Date.parse('2026-11-08T12:00:00Z'), at = '2026-11-08T11:58:00+00:00';
const rule = c => ({source:'rules', title:'Revisa', message:'Nivel bajo.', next:'Rellena', generatedAt:at, ...c});
const exp = c => ({status:'available', source:'ai', text:'Porque…', generatedAt:at, expiresAt:'2026-11-08T13:00:00+00:00', ...c});
const base = c => ({rule:rule(), readings:{state:'current', at}, explanation:null, ...c});
const view = raw => D.present(D.adapt(raw), NOW);
// Fechas: solo el formato canónico, con T y zona.
for(const bad of ['2026-11-08T11:58:00', '2026-11-08 11:58:00+00:00', '2026-11-08', '20261108T115800Z', '2026-11-08T11:58Z', 'ayer']) assert.equal(D.adapt(base({rule:rule({generatedAt:bad})})), null, bad);
for(const good of ['2026-11-08T11:58:00.000+00:00', '2026-11-08T11:58:00Z', '2026-11-08T05:58:00-06:00']) assert.notEqual(D.adapt(base({rule:rule({generatedAt:good})})), null, good);
// Vacío e inválido: null, sin lanzar.
for(const bad of [null, undefined, '', 'x', 7, [], {}, {rule:{}}, base({rule:rule({source:'ai'})}), base({rule:rule({title:' '})}), base({rule:rule({title:'x'.repeat(121)})}), base({rule:rule({message:7})}), base({rule:rule({message:'a\u0000b'})}), base({rule:rule({generatedAt:'ayer'})}), base({rule:rule({next:5})}), base({readings:null}), base({readings:{state:'fresh', at}}), base({readings:{state:'stale', at:null}}), base({readings:{state:'missing', at}})])
  assert.equal(D.adapt(bad), null, JSON.stringify(bad));
assert.equal(D.present(null), null);
// Solo reglas: sin nada que mencione IA.
const solo = view(base());
assert.equal(solo.title, 'Revisa'); assert.match(solo.origin, /^Resumen por reglas/); assert.equal(solo.explanation, null);
assert.ok(!/\bIA\b/.test(JSON.stringify(solo)));
assert.equal(view(base({rule:rule({next:null})})).next, null);
// Lecturas: cada estado con su texto.
assert.match(view(base({readings:{state:'missing', at:null}})).readings, /Sin lecturas disponibles/);
assert.match(view(base({readings:{state:'stale', at}})).readings, /Lecturas antiguas/);
assert.match(view(base()).readings, /^Lecturas del /);
// Explicación: disponible, y etiquetada como IA solo entonces.
const full = view(base({explanation:exp()}));
assert.equal(full.explanation.state, 'available'); assert.equal(full.explanation.text, 'Porque…'); assert.match(full.explanation.note, /generada con IA/);
assert.equal(full.title, 'Revisa', 'la explicación no sustituye al mensaje');
// Sin validez: la regla se mantiene y no hay texto.
for(const bad of [exp({text:''}), exp({text:'x'.repeat(1201)}), exp({status:'blocked'}), exp({status:'truncated'}), exp({status:'failed'}), exp({status:'empty'}), exp({source:'rules'}), exp({expiresAt:null}), exp({generatedAt:'x'}), 'x', 7, []]) {
  const v = view(base({explanation:bad}));
  assert.equal(v.title, 'Revisa'); assert.equal(v.explanation.state, 'unavailable', JSON.stringify(bad)); assert.equal(v.explanation.text, undefined);
}
// Caducidad: del servidor y al pasar el tiempo. No altera las lecturas.
const fromServer = view(base({explanation:{status:'expired'}}));
assert.equal(fromServer.explanation.state, 'expired'); assert.match(fromServer.readings, /^Lecturas del /);
const live = D.adapt(base({explanation:exp()}));
assert.equal(D.present(live, Date.parse('2026-11-08T13:00:00Z')).explanation.state, 'expired');
assert.equal(D.present(live, Date.parse('2026-11-08T12:59:59Z')).explanation.state, 'available');
assert.match(D.present(live, Date.parse('2026-11-08T14:00:00Z')).readings, /^Lecturas del /);
assert.equal(D.msUntilExpiry(live, NOW), 3600000);
assert.equal(D.msUntilExpiry(live, Date.parse('2026-11-09T00:00:00Z')), null);
assert.equal(D.msUntilExpiry(D.adapt(base()), NOW), null);
// El texto malicioso sigue siendo dato y la vista no usa HTML.
assert.equal(view(base({rule:rule({title:'<img src=x onerror=alert(1)>'})})).title, '<img src=x onerror=alert(1)>');
const v = read('vista/diagnostico.js'), card = read('vista/huerto-usuario.js'), model = read('modelo/huerto-usuario.js'), admin = read('vista/administracion.js'), adminModel = read('modelo/administracion.js'), adminControl = read('controlador/administracion.js');
assert.ok(!/innerHTML|fetch\(|ChilitoHTTP/.test(v));
assert.ok(!/document\.|querySelector/.test(read('modelo/diagnostico.js')));
assert.ok(model.includes('diagnosis:GardenDiagnosis.adapt(raw.body.diagnosis)'));
assert.ok(!/data\.diagnosis|diagnosis\.title/.test(card), 'la plantilla no inserta datos del resumen');
assert.ok(card.includes('>Resumen de tu huerto</h2>') && !card.includes('Diagnóstico inteligente'));
// Despliegues: etiquetas claras y tipos sin cambios.
for(const label of ['Comprobar formato', 'Registrar solicitud de despliegue', 'no despliega nada', 'No está conectado a ningún asistente']) assert.ok(admin.includes(label), label);
for(const old of ['Validar versión', 'Publicar modelo', 'Guardar metadatos']) assert.ok(!admin.includes(old), old);
assert.ok(adminControl.includes('No se ha desplegado nada'));
assert.ok(adminModel.includes("weights:'Actualizar pesos del modelo',math:'Publicar modelo matemático nuevo',rollback:'Revertir a versión estable'"));
assert.ok(!/prompt/i.test(adminModel));
// Caducidad: solo se repinta la tarjeta; la pantalla, con sus diálogos y su foco, no se reconstruye.
async function expiryKeepsScreen() {
  const timers = [], paints = []; let rebuilt = 0, now = NOW;
  const root = {set innerHTML(_) { rebuilt += 1; }, querySelector: s => s === '[data-garden-diagnosis]' ? {} : null, addEventListener() {}};
  const sandbox = vm.createContext({AbortController, setTimeout: (f, ms) => timers.push({f, ms}), clearTimeout: id => { if(id) timers[id-1].cleared = true; }, setInterval: () => 1, clearInterval() {},
    document:{addEventListener() {}}, UserGardenViews:{render:() => ''}, GardenDiagnosisViews:{paint:(_, view) => paints.push(view)}, AppModel:{garden:g => g, alias:() => ''}, AuthService:{session:{}},
    CareGuideUserController:{attach:() => ({paint() {}})}, BindingUserController:{attach() {}}});
  vm.runInContext(read('modelo/diagnostico.js'), sandbox);
  sandbox.nowValue = () => now;
  vm.runInContext('Date.now = () => nowValue();', sandbox);
  vm.runInContext(read('controlador/huerto-usuario.js'), sandbox);
  const adapted = vm.runInContext('GardenDiagnosis', sandbox).adapt(base({explanation:exp()}));
  const controller = vm.runInContext('UserGardenController', sandbox).mount('huerto', {root, service:{load:async () => ({garden:{status:'waiting'}, diagnosis:adapted})}});
  await new Promise(resolve => setImmediate(resolve));
  const timer = timers.filter(t => !t.cleared).at(-1);
  assert.equal(timer.ms, 3600000);
  assert.equal(paints.at(-1).explanation.state, 'available');
  const before = rebuilt;
  now += 3600000;
  timer.f();
  assert.equal(rebuilt, before, 'la caducidad no debe reconstruir la pantalla');
  assert.equal(paints.at(-1).explanation.state, 'expired');
  assert.equal(paints.at(-1).title, 'Revisa', 'la regla permanece');
  controller.dispose();
}
expiryKeepsScreen().then(() => console.log('PASS tarjeta del huerto y etiquetas de despliegues')).catch(error => { console.error(error); process.exit(1); });
