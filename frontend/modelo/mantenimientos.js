// Solo respuestas autorizadas por Django. El estado vigente lo calcula el servidor.
const MaintenanceService = (() => {
  const tasks = UserGardenService.tasks;
  const base = '/api/admin/mantenimientos';
  async function send(path, options = {}) {
    try {
      const response = await ChilitoHTTP.request(path, options);
      if(response.http === 401) { ChilitoHTTP.sessionExpired(); return {status:'unauthenticated'}; }
      if(response.http === 409) return {status:response.body?.code === 'stale-record' ? 'stale' : 'conflict'};
      if(response.http === 403) return {status:'forbidden'};
      if(response.http === 429) return {status:'limited'};
      if(response.http === 400) return {status:'invalid'};
      return [200,201].includes(response.http) ? response.body : {status:'error'};
    } catch { return {status:'error'}; }
  }
  const query = filters => {
    const params = new URLSearchParams(Object.entries(filters).filter(([,value]) => value));
    return params.size ? '?'+params : '';
  };
  return Object.freeze({
    tasks,
    list: (filters = {}) => send(base+query(filters)),
    detail: id => send(base+'/'+encodeURIComponent(id)),
    create: (gardenId,task) => send(base,{method:'POST',body:{gardenId,task}}),
    correct: (id,task,reason,revision) => send(base+'/'+encodeURIComponent(id)+'/corregir',{method:'POST',body:{task,reason,revision}}),
    void: (id,reason,revision) => send(base+'/'+encodeURIComponent(id)+'/anular',{method:'POST',body:{reason,revision}})
  });
})();

// Fechas civiles: UTC solo para aritmética de calendario, sin convertir la fecha escrita.
// Hoy se obtiene del reloj local; las cadenas enviadas nunca usan toISOString().
const MaintenanceDates = (() => {
  function make(year, month, day) {
    const date = new Date(0);
    date.setUTCHours(12,0,0,0);
    date.setUTCFullYear(year,month,day);
    return date;
  }
  const format = date => `${String(date.getUTCFullYear()).padStart(4,'0')}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  function parse(value) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year,month,day] = value.split('-').map(Number);
    if(year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = make(year,month-1,day);
    return format(date) === value ? date : null;
  }
  function shift(date, days = 0, months = 0) {
    const target = make(date.getUTCFullYear(),date.getUTCMonth()+months,1);
    const last = make(target.getUTCFullYear(),target.getUTCMonth()+1,0).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(),last)+days);
    return target.getUTCFullYear() >= 1 && target.getUTCFullYear() <= 9999 ? target : date;
  }
  function weeks(year, month) {
    const offset = (make(year,month,1).getUTCDay()+6)%7;
    const count = make(year,month+1,0).getUTCDate();
    return Array.from({length:Math.ceil((offset+count)/7)},(_,week) =>
      Array.from({length:7},(_,weekday) => {
        const day = week*7+weekday-offset+1;
        return day > 0 && day <= count ? {value:format(make(year,month,day)),day} : null;
      }));
  }
  function today() {
    const local = new Date();
    return make(local.getFullYear(),local.getMonth(),local.getDate());
  }
  return Object.freeze({parse,format,make,shift,weeks,today});
})();
