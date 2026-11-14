// Regresión de la ayuda para vincular: borrador de correo sin secretos. No accede a la API real.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = name => fs.readFileSync(`${__dirname}/${name}`, 'utf8');
function load(supportContact) {
  const context = vm.createContext({ChilitoHTTP:{configuration:{supportContact}}});
  vm.runInContext(read('modelo/vinculacion.js'), context);
  return vm.runInContext('BindingHelp', context);
}
const SUPPORT = 'soporte@example.test';
const SUBJECT = '[El Chilito] Ayuda con la vinculación';
const OPENING = 'Hola, necesito ayuda para vincular mi huerto. ';
const parts = href => {
  const [target, query] = href.slice('mailto:'.length).split('?');
  assert.deepEqual([...new URLSearchParams(query).keys()], ['subject', 'body']);
  const field = name => decodeURIComponent(query.split('&').find(p => p.startsWith(name + '=')).slice(name.length + 1));
  return {target, subject:field('subject'), body:field('body')};
};
const help = load(SUPPORT);

// Cuatro motivos, destinatario y asunto.
for(const [reason, detail, expected] of [
  ['expired', '', 'venció antes de completar la vinculación'],
  ['lost', '', 'Perdí o no encuentro el código'],
  ['rejected', '', 'no funciona al intentar vincular'],
  ['other', 'La pantalla se queda en blanco.', 'por este motivo: La pantalla se queda en blanco.']]) {
  const draft = help.draft(reason, detail);
  assert.equal(draft.status, 'ready', reason);
  const mail = parts(draft.href);
  assert.equal(mail.target, SUPPORT);
  assert.equal(mail.subject, SUBJECT);
  assert.ok(mail.body.startsWith(OPENING), reason);
  assert.ok(mail.body.includes(expected), reason);
  assert.ok(mail.body.includes('\r\n\r\nInformación adicional'), reason);
}
assert.ok(help.draft('expired').body.includes('El código que recibí venció antes de completar la vinculación. Quisiera solicitar orientación para obtener uno nuevo.'));

// Texto para copiar: sale del mismo borrador, con las tres partes separadas y sin la URL.
for(const [reason, detail] of [['expired'], ['lost'], ['rejected'], ['other', 'Se queda en blanco.']]) {
  const draft = help.draft(reason, detail);
  assert.equal(draft.text, `Para: ${SUPPORT}\nAsunto: ${SUBJECT}\n\nMensaje:\n${draft.body.trimEnd()}\n`, reason);
  assert.ok(!draft.text.includes('mailto'), reason);
  assert.ok(!draft.text.includes('%'), reason);
}
assert.notEqual(help.draft('expired').text, help.draft('lost').text);
for(const refused of [help.draft('', ''), help.draft('other', ''), help.draft('other', 'el 2FA era 123456'), load('').draft('expired')])
  assert.equal(refused.text, undefined);
assert.ok(help.draft('other', 'ñ & ?x=1 #a %20 🌶️').text.includes('ñ & ?x=1 #a %20 🌶️'));

// «Otro motivo» exige explicación; un motivo cerrado ignora el texto oculto.
assert.equal(help.draft('other', '').status, 'need-detail');
assert.equal(help.draft('other', ' \n\t ').status, 'need-detail');
assert.equal(help.draft('', '').status, 'need-reason');
assert.equal(help.draft('__proto__', 'x').status, 'need-reason');
const atLimit = 'ab '.repeat((help.MAX_DETAIL - 3) / 3) + 'abc';
assert.equal(atLimit.length, help.MAX_DETAIL);
assert.equal(help.draft('other', atLimit).status, 'ready');
assert.equal(help.draft('other', atLimit + 'd').status, 'too-long');
assert.ok(!help.draft('expired', 'texto oculto').body.includes('texto oculto'));

// Caracteres especiales: no rompen la URL, no añaden cabeceras y vuelven idénticos.
const special = 'ñáü & ?x=1 #a %20 + "c" <b> 🌶️\r\ncc: otro@example.test&bcc=x@example.test';
const specialMail = help.draft('other', special);
assert.equal(specialMail.status, 'ready');
assert.ok(!/[\s#<>"]/.test(specialMail.href));
assert.equal(specialMail.href.match(/&/g).length, 1);
assert.equal(specialMail.href.match(/\?/g).length, 1);
assert.ok(parts(specialMail.href).body.includes('ñáü & ?x=1 #a %20 + "c" <b> 🌶️\r\ncc: otro@example.test&bcc=x@example.test'));
assert.equal(help.draft('other', 'mal \uD83D formado').status, 'ready');
assert.ok(!parts(help.draft('other', 'a\u0000b\u0007c').href).body.includes('\u0000'));

// Nada de secretos en el borrador.
const code = '0123456789ABCDEFGHJKMNPQRS';
for(const value of [`mi código es ${code}`, code.toLowerCase(), code.replace(/(.{6})/g, '$1-'), code.replace(/(.{6})/g, '$1 '), 'el 2FA era 123456'])
  assert.equal(help.draft('other', value).status, 'secret', value);
assert.equal(help.draft('other', 'Mi teléfono no recibe el correo desde 2024.').status, 'ready');
for(const reason of ['expired', 'lost', 'rejected']) {
  const body = help.draft(reason).body;
  assert.ok(!/(?:[0-9A-Z]-?){26}|\d{6}/.test(body), reason);
}

// Destinatario: solo el contacto configurado; si falta o no es válido, no se inventa otro.
assert.equal(help.contact(), SUPPORT);
assert.equal(help.draft('expired').address, SUPPORT);
for(const value of ['', '   ', null, undefined, 'no-es-correo', 'a b@example.test', 7]) {
  const missing = load(value);
  assert.equal(missing.contact(), null);
  assert.equal(missing.draft('expired').status, 'unavailable');
}
const crafted = load('a?bcc=x@example.test');
assert.equal(parts(crafted.draft('expired').href).target, 'a%3Fbcc%3Dx@example.test');

// Separación de contextos y de capas.
const view = read('vista/vinculacion.js'), model = read('modelo/vinculacion.js'), controller = read('controlador/vinculacion.js');
assert.ok(!view.includes('#consiguelo'));
assert.ok(!view.includes('Consíguelo'));
assert.ok(!view.includes('Copiar correo'));
assert.ok(read('vista/paginas.js').includes('id="consiguelo"'));
for(const label of ['Solicitar ayuda para vincular mi huerto', 'El código venció.', 'Perdí o no encuentro el código.', 'El código no funciona.', 'Otro motivo', 'Preparar correo', 'Copiar mensaje preparado', 'Copiar dirección de soporte']) assert.ok(view.includes(label), label);
assert.ok(!/fetch\(|ChilitoHTTP/.test(view));
assert.ok(!/document\.|querySelector/.test(model));
for(const source of [view, model, controller]) assert.ok(!/correo enviado|mensaje enviado/i.test(source));
const helpSource = controller.slice(controller.indexOf('const BindingHelpController'));
assert.ok(!/service\.consume|ChilitoHTTP|fetch\(/.test(helpSource));
assert.equal(helpSource.match(/service\.draft\(/g).length, 1);
assert.equal(helpSource.match(/openMail\(/g).length, 1);
console.log('PASS ayuda de vinculación');
