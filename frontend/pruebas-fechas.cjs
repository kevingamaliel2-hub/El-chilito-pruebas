// Regresión de fechas civiles y contrato HTTP de los filtros; no accede a la API real.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
async function checkZone(TZ) {
  process.env.TZ = TZ;
  const calls = [];
  const context = vm.createContext({URLSearchParams,UserGardenService:{tasks:{}},ChilitoHTTP:{
    async request(path) { calls.push(path); return {http:200,body:{status:'ready'}}; }
  }});
  vm.runInContext(fs.readFileSync(__dirname+'/modelo/mantenimientos.js','utf8'),context);
  const dates = vm.runInContext('MaintenanceDates',context);
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  assert.equal(dates.format(dates.today()),localToday);
  for(const value of ['0001-01-01','0099-12-31','2000-02-29','2011-12-30','2024-02-29','2026-11-07','9999-12-31']) {
    assert.equal(dates.format(dates.parse(value)),value);
  }
  for(const value of ['','2026-02-29','1900-02-29','2026-04-31','2026-13-01','0000-01-01','10000-01-01','2026-1-01','07/11/2026']) {
    assert.equal(dates.parse(value),null,value);
  }
  for(const [value,days,months,expected] of [
    ['2024-02-28',1,0,'2024-02-29'],['2026-01-31',0,1,'2026-02-28'],
    ['2024-02-29',0,12,'2025-02-28'],['2026-12-31',1,0,'2027-01-01'],
    ['2026-03-08',1,0,'2026-03-09'],['2026-10-25',1,0,'2026-10-26'],
    ['2011-12-29',1,0,'2011-12-30'],
    ['0001-01-01',-1,0,'0001-01-01'],['9999-12-31',1,0,'9999-12-31']
  ]) assert.equal(dates.format(dates.shift(dates.parse(value),days,months)),expected);
  const february = dates.weeks(2024,1).flat().filter(Boolean);
  assert.equal(february.length,29);
  assert.equal(february.at(-1).value,'2024-02-29');
  const december = dates.weeks(2011,11).flat().filter(Boolean).map(day => day.value);
  assert.equal(new Set(december).size,31);
  assert.ok(december.includes('2011-12-30'));
  const service = vm.runInContext('MaintenanceService',context);
  await service.list({since:'2026-11-07',until:'2026-11-09',garden:'1',state:'active',task:'inspection'});
  assert.equal(calls.at(-1),'/api/admin/mantenimientos?since=2026-11-07&until=2026-11-09&garden=1&state=active&task=inspection');
  await service.list({since:'',until:''});
  assert.equal(calls.at(-1),'/api/admin/mantenimientos');
  console.log(`PASS fechas civiles, límites, bisiestos y filtros ISO: ${TZ}`);
}
(async() => {
  for(const zone of ['America/Mexico_City','America/Los_Angeles','Europe/Madrid','Pacific/Kiritimati','Pacific/Apia']) await checkZone(zone);
})().catch(error => { console.error(error); process.exitCode = 1; });
