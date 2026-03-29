const state = JSON.parse(JSON.stringify(window.DIECK_DATA));
const el = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const days = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
const clean = s => String(s ?? '').trim().replace(/\s+/g,' ');
const toNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

function weekNumber(d){
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate() + 4 - (dt.getDay() || 7));
  const yearStart = new Date(dt.getFullYear(), 0, 1);
  return Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
}
function formatLongDate(d){
  const x = new Date(d);
  return `${days[x.getDay()]} ${x.getDate()} DE ${months[x.getMonth()]} DE ${x.getFullYear()}`;
}
function formatRange(monday, sunday){
  const a = new Date(monday), b = new Date(sunday);
  return `DEL ${a.getDate()} AL ${b.getDate()} DE ${months[a.getMonth()]} DE ${a.getFullYear()}`;
}
function weekRange(d){
  const x = new Date(d);
  const day = x.getDay() || 7;
  const monday = new Date(x); monday.setDate(x.getDate() - day + 1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}
function findMaster(code){ return state.master.find(r => r.codigo === code || r.codigo === code.replace(/^PTE-/, 'PT-')) || {}; }
function calcQQ(master, qty){ return master.peso ? Math.ceil((toNum(qty) * toNum(master.peso)) / 100) : ''; }
function calcHorasPaqueteria(qty){ const q = toNum(qty); if (!q) return ''; return (q / 235).toFixed(2); }
function calcTarimas(master, qty){ const div = toNum(master.tarima_div); if (!div) return ''; return Math.ceil(toNum(qty) / div); }
function calcBobina(master, qty){ const x = toNum(master.bobina_x); const y = toNum(master.bobina_y); if (!x || !y) return '-'; return Math.ceil((toNum(qty) / y) * x); }
function currentWeek(){ return weekNumber(state.ui.date); }
function currentRange(){ return weekRange(state.ui.date); }
function codeForLot(master){ const prefix = master.lot_prefix || ''; const y = new Date(state.ui.date).getFullYear().toString().slice(-2); const m = pad(new Date(state.ui.date).getMonth() + 1); return `${prefix}-${y}-${m}`; }
function lotCode(master, qty){ const base = toNum(master.lot_base) || 1; const seq = Math.max(1, Math.ceil(toNum(qty) / base)); return `${codeForLot(master)}-${pad(seq)}`; }
function groupedWeeklyPlans(){ const wk = currentWeek(); return state.weeklyPlans.filter(r => r.semana === wk); }
function groupedProduction(){ const wk = currentWeek(); return state.production.filter(r => r.semana === wk); }

function renderMasterTable(){
  const filter = clean(el('masterFilter').value).toUpperCase();
  const tb = el('masterTable').querySelector('tbody');
  tb.innerHTML = '';
  state.master.filter(r => !filter || clean(r.codigo).toUpperCase().includes(filter) || clean(r.descripcion).toUpperCase().includes(filter)).forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input data-k="codigo" value="${r.codigo || ''}"></td>
      <td><input data-k="descripcion" value="${r.descripcion || ''}"></td>
      <td><input data-k="peso" value="${r.peso || ''}"></td>
      <td><input data-k="unidad" value="${r.unidad || ''}"></td>
      <td><input data-k="entero_min" value="${r.entero_min || ''}"></td>
      <td><input data-k="mignon_max" value="${r.mignon_max || ''}"></td>
      <td><input data-k="pulido_min" value="${r.pulido_min || ''}"></td>
      <td><input data-k="area" value="${r.area || ''}"></td>
      <td><input data-k="tarima_div" value="${r.tarima_div || ''}"></td>
      <td><input data-k="bobina_x" value="${r.bobina_x || ''}"></td>
      <td><input data-k="bobina_y" value="${r.bobina_y || ''}"></td>
      <td><input data-k="lot_prefix" value="${r.lot_prefix || ''}"></td>
      <td><input data-k="lot_base" value="${r.lot_base || ''}"></td>
      <td><button class="btn" data-del="${idx}" type="button">×</button></td>
    `;
    tb.appendChild(tr);
  });
}
function renderHistory(){
  const filter = clean(el('historyFilter').value).toUpperCase();
  const box = el('historyBox');
  const items = [
    { key:'order|'+state.ui.date, title:`ORDEN ${state.ui.date}`, sub:'Vista actual' },
    { key:'weekly|'+currentWeek(), title:`PRG-Semana ${currentWeek()}`, sub:'Programación semanal' },
    { key:'prod|'+currentWeek(), title:`PRD-Semana ${currentWeek()}`, sub:'Producción semanal' }
  ];
  box.innerHTML = items.filter(i => !filter || clean(i.title + ' ' + i.sub).toUpperCase().includes(filter))
    .map(i => `<div class="item"><div><b>${i.title}</b><div class="mini">${i.sub}</div></div><div><button class="btn" data-open="${i.key}" type="button">Abrir</button></div></div>`).join('');
}
function setSheet(html){ el('sheet').innerHTML = html; }
function baseSheet(title, subtitle){ return `<div class="sheet-title">${title}</div><div class="sheet-sub">${subtitle || ''}</div>`; }

function renderOrder(){
  const wk = currentWeek();
  const wkPlans = groupedWeeklyPlans();
  const { monday, sunday } = currentRange();
  let html = baseSheet('ORDEN DIARIA DE PRODUCCIÓN', `SEMANA ${wk} | ${formatRange(monday, sunday)}`);
  html += `<div class="section"><div class="date-title nowrap">${formatLongDate(state.ui.date)}</div><table class="tbl small"><thead><tr><th>CÓDIGO SAP</th><th>DESCRIPCIÓN</th><th>ÁREA</th><th>PROGRAMACIÓN</th><th>QQ</th><th>ENVAS</th><th>HRS DE TRABAJO</th><th>TARIMAS</th><th>BOBINA IMPR LBS</th></tr></thead><tbody>`;
  wkPlans.forEach(r => { const m = findMaster(r.codigo); const qq = calcQQ(m, r.programado); const envas = r.area === 'PAQUETERIA' ? 2 : ''; const hrs = r.area === 'PAQUETERIA' ? calcHorasPaqueteria(r.programado) : ''; const tar = calcTarimas(m, r.programado); const bob = calcBobina(m, r.programado); html += `<tr><td>${r.codigo}</td><td>${r.presentacion}</td><td>${r.area}</td><td>${r.programado}</td><td>${qq || ''}</td><td>${envas}</td><td>${hrs}</td><td>${tar}</td><td>${bob}</td></tr>`; });
  html += `</tbody></table></div>`;
  setSheet(html);
}
function renderWeekly(){
  const wk = currentWeek();
  const { monday, sunday } = currentRange();
  let html = baseSheet('REPORTE DE ORDENES SEMANALES - PLANIFICACIÓN', `Programa semanal de producción | SEMANA ${wk} | ${formatRange(monday, sunday)}`);
  html += `<table class="tbl small"><thead><tr><th>FECHA</th><th>SEMANA</th><th>CÓDIGO SAP</th><th>PRESENTACIÓN</th><th>AREA</th><th>PROGRAMADO</th><th>CANTIDAD ME</th><th>TIPO</th></tr></thead><tbody>`;
  groupedWeeklyPlans().forEach(r => { html += `<tr><td>${r.fecha}</td><td>${r.semana}</td><td>${r.codigo}</td><td>${r.presentacion}</td><td>${r.area}</td><td>${r.programado}</td><td></td><td></td></tr>`; });
  html += `</tbody></table>`;
  setSheet(html);
}
function renderProduction(){
  let html = baseSheet('REGISTRO DE PRODUCCIÓN DIARIA', `Semana ${currentWeek()} | Producción real`);
  html += `<table class="tbl small"><thead><tr><th>AÑO</th><th>MES</th><th>SEMANA</th><th>DIA</th><th>FECHA</th><th>MATERIAL</th><th>PRESENTACIÓN</th><th>AREA</th><th>TOTAL</th><th>TURNO</th><th>OBSERVACIÓN</th></tr></thead><tbody>`;
  groupedProduction().forEach(r => { const d = new Date(r.fecha); html += `<tr><td>${d.getFullYear()}</td><td>${months[d.getMonth()].slice(0,3)}</td><td>${r.semana}</td><td>${r.dia}</td><td>${r.fecha}</td><td>${r.material}</td><td>${r.presentacion}</td><td>${r.area}</td><td>${r.total}</td><td>${r.turno}</td><td>${r.observacion || ''}</td></tr>`; });
  html += `</tbody></table>`;
  setSheet(html);
}
function renderCompliance(){
  const wk = currentWeek();
  const { monday, sunday } = currentRange();
  const daysOrder = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'];
  const plans = groupedWeeklyPlans();
  let html = baseSheet(`Programa de Cumplimiento del Plan Semanal - Semana ${wk}`, `${formatRange(monday, sunday)}`);
  html += `<table class="tbl small"><thead><tr><th>CÓDIGO SAP</th><th>AREA</th><th>PRESENTACION</th><th>PROGRAMACIÓN</th>${daysOrder.map(d=>`<th>${d}</th>`).join('')}<th>TOTAL</th><th>CUMPLIMIENTO</th><th>DIFERENCIA</th><th>SC / IC</th></tr></thead><tbody>`;
  plans.forEach(p => { const prodByDay = daysOrder.map(day => groupedProduction().filter(x => x.material === p.codigo && x.dia.toUpperCase() === day).reduce((a,b)=>a+toNum(b.total),0)); const total = prodByDay.reduce((a,b)=>a+b,0); const cumpl = p.programado ? Math.min(100, (total / p.programado) * 100) : 0; const diff = total - p.programado; const scic = p.programado ? ((total / p.programado) * 100).toFixed(2) + '%' : ''; html += `<tr><td>${p.codigo}</td><td>${p.area}</td><td>${p.presentacion}</td><td>${p.programado}</td>${prodByDay.map(v=>`<td>${v || ''}</td>`).join('')}<td>${total || 0}</td><td>${Math.round(cumpl)}%</td><td>${diff}</td><td>${scic}</td></tr>`; });
  html += `</tbody></table><div class="note">Actualizado por última vez - ${formatLongDate(state.ui.date)} | Por Supervisor de Producción BD</div>`;
  setSheet(html);
}
function renderLotification(){
  const wk = currentWeek();
  const monthLabel = months[new Date(state.ui.date).getMonth()];
  const monthData = {};
  groupedProduction().forEach(p => { monthData[p.material] = (monthData[p.material] || 0) + toNum(p.total); });
  let html = baseSheet('Control de Validación - Lotificaciónes en Productos Terminados & Subproductos en Mes Actual', `${new Date(state.ui.date).getFullYear()} ${monthLabel} | Semana ${wk}`);
  html += `<table class="tbl small"><thead><tr><th>CÓDIGO SAP</th><th>PRESENTACIÓN</th><th>AREA</th><th>CAMBIO</th><th>TIPO</th><th>CODIFICACIÓN</th><th>PROCESO</th><th>UMD PNDX CAMBIO</th><th>LOTE DISPONIBLE</th><th>LIBRE UTILIZACIÓN</th></tr></thead><tbody>`;
  Object.entries(monthData).forEach(([code,total]) => { const m = findMaster(code); const base = m.lot_base || 1; const available = Math.ceil(total / base); const cod = codeForLot(m); html += `<tr><td>${code}</td><td>${m.descripcion || ''}</td><td>${m.area || ''}</td><td>SEMANAL</td><td>${m.lot_prefix || ''}</td><td>${cod}</td><td>${m.entero_min || ''}</td><td>${m.mignon_max || ''}</td><td>${available}</td><td>${cod}-${pad(available)}</td></tr>`; });
  html += `</tbody></table><div class="note">Actualizado por última vez - ${formatLongDate(state.ui.date)} | Por Supervisor de Producción BD</div>`;
  setSheet(html);
}
function renderLiberations(){
  let html = baseSheet('REGISTRO DE LIBERACIÓN', `Fecha y hora de liberación: ${formatLongDate(state.ui.date)} - 8:11 AM`);
  html += `<table class="tbl small"><thead><tr><th>CÓDIGO</th><th>PRESENTACIÓN</th><th>F. LIB</th><th>F. ELAB</th><th>F. VENC</th><th>LOTE</th><th>TURN</th><th>CANTIDAD</th><th>ENTERO</th><th>HUMEDAD</th><th>EST. ENTERO</th><th>EST. PULIDO</th></tr></thead><tbody>`;
  groupedWeeklyPlans().slice(0,10).forEach(r => { const m = findMaster(r.codigo); html += `<tr><td>${r.codigo}</td><td>${r.presentacion}</td><td>${state.ui.date}</td><td>${state.ui.date}</td><td>${state.ui.date}</td><td>${lotCode(m, r.programado)}</td><td>A</td><td>${r.programado}</td><td>${m.entero_min || ''}</td><td></td><td>${m.entero_min || ''}</td><td>${m.pulido_min || ''}</td></tr>`; });
  html += `</tbody></table>`;
  setSheet(html);
}
function renderMaster(){
  let html = baseSheet('Tabla Maestra de Productos y Especificaciones Técnicas', 'Base editable');
  html += `<table class="tbl small"><thead><tr><th>CÓDIGO</th><th>DESCRIPCIÓN</th><th>PESO / UNIDAD</th><th>FAMILIA</th><th>PROCESO</th><th>ENTERO</th><th>MIGNON</th><th>PULIDO</th><th>AREA</th><th>TARIMA</th><th>BOBINA X</th><th>BOBINA Y</th><th>LOTE</th></tr></thead><tbody>`;
  state.master.forEach(r => { html += `<tr><td>${r.codigo}</td><td>${r.descripcion}</td><td>${r.peso}/${r.unidad}</td><td></td><td></td><td>${r.entero_min}</td><td>${r.mignon_max}</td><td>${r.pulido_min}</td><td>${r.area}</td><td>${r.tarima_div}</td><td>${r.bobina_x || ''}</td><td>${r.bobina_y || ''}</td><td>${r.lot_prefix || ''}-${String(new Date(state.ui.date).getFullYear()).slice(-2)}-${pad(new Date(state.ui.date).getMonth()+1)}</td></tr>`; });
  html += `</tbody></table>`;
  setSheet(html);
}
function renderHistory(){
  let html = baseSheet('Histórico', 'Consulta rápida de registros');
  html += `<div class="compact">Semana ${currentWeek()} | ${formatLongDate(state.ui.date)}</div>`;
  html += `<table class="tbl small"><thead><tr><th>TIPO</th><th>DESCRIPCIÓN</th></tr></thead><tbody><tr><td>ORDEN</td><td>${state.ui.date}</td></tr><tr><td>PROGRAMACIÓN</td><td>Semana ${currentWeek()}</td></tr><tr><td>PRODUCCIÓN</td><td>Registros cargados</td></tr></tbody></table>`;
  setSheet(html);
}
function render(){
  el('dateSel').value = state.ui.date;
  el('weekSel').value = currentWeek();
  el('viewSel').value = state.ui.view;
  el('modeSel').value = state.ui.mode;
  if (state.ui.view === 'order') renderOrder();
  else if (state.ui.view === 'weekly') renderWeekly();
  else if (state.ui.view === 'production') renderProduction();
  else if (state.ui.view === 'compliance') renderCompliance();
  else if (state.ui.view === 'lotification') renderLotification();
  else if (state.ui.view === 'liberations') renderLiberations();
  else if (state.ui.view === 'master') renderMaster();
  else renderHistory();
  renderMasterTable();
  renderHistory();
}
async function saveToGitHub(){
  const { owner, repo, branch, path, token } = state.ui.github;
  if (!owner || !repo || !token) { alert('Falta GitHub owner, repo o token.'); return; }
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const existing = await fetch(url, {headers:{Authorization:`Bearer ${token}`,'Accept':'application/vnd.github+json'}});
  let sha = undefined;
  if (existing.ok) {
    const j = await existing.json();
    sha = j.sha;
  }
  const body = { message: 'Sync portal SAP data', content: btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2)))), branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, {method:'PUT',headers:{Authorization:`Bearer ${token}`,'Accept':'application/vnd.github+json','Content-Type':'application/json'},body: JSON.stringify(body)});
  alert(res.ok ? 'Guardado en GitHub' : 'No se pudo guardar en GitHub');
}
async function loadFromGitHub(){
  const { owner, repo, branch, path, token } = state.ui.github;
  if (!owner || !repo || !token) { alert('Falta GitHub owner, repo o token.'); return; }
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch || 'main')}`;
  const res = await fetch(url, {headers:{Authorization:`Bearer ${token}`,'Accept':'application/vnd.github+json'}});
  if (!res.ok) { alert('No se pudo cargar desde GitHub'); return; }
  const j = await res.json();
  const decoded = decodeURIComponent(escape(atob(j.content.replace(/\n/g,''))));
  const parsed = JSON.parse(decoded);
  Object.assign(state, parsed);
  render();
}
function exportJSON(){ const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); }
function bind(){
  el('dateSel').addEventListener('change', e => { state.ui.date = e.target.value; render(); });
  el('viewSel').addEventListener('change', e => { state.ui.view = e.target.value; render(); });
  el('modeSel').addEventListener('change', e => { state.ui.mode = e.target.value; render(); });
  el('btnPrint').addEventListener('click', () => window.print());
  el('btnExport').addEventListener('click', exportJSON);
  el('btnSave').addEventListener('click', saveToGitHub);
  el('btnLoad').addEventListener('click', loadFromGitHub);
  el('btnApplyGitHub').addEventListener('click', () => {
    state.ui.github.owner = el('ghOwner').value.trim();
    state.ui.github.repo = el('ghRepo').value.trim();
    state.ui.github.branch = el('ghBranch').value.trim() || 'main';
    state.ui.github.path = el('ghPath').value.trim() || 'data.json';
    state.ui.github.token = el('ghToken').value.trim();
    el('ghStatus').textContent = 'GitHub configurado';
  });
  el('btnSyncGitHub').addEventListener('click', saveToGitHub);
  el('masterFilter').addEventListener('input', renderMasterTable);
  el('historyFilter').addEventListener('input', renderHistory);
  el('masterTable').addEventListener('input', e => { const tr = e.target.closest('tr'); if (!tr) return; const idx = [...tr.parentElement.children].indexOf(tr); const k = e.target.dataset.k; if (!k) return; state.master[idx][k] = ['peso','entero_min','mignon_max','tarima_div','bobina_x','bobina_y','lot_base'].includes(k) ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value; });
  el('masterTable').addEventListener('click', e => { const del = e.target.dataset.del; if (del === undefined) return; state.master.splice(Number(del), 1); render(); });
  el('btnAddMaster').addEventListener('click', () => { state.master.unshift({codigo:'',descripcion:'',peso:'',unidad:'',area:'',entero_min:'',mignon_max:'',pulido_min:'',tarima_div:'',bobina_x:'',bobina_y:'',lot_prefix:'',lot_base:''}); render(); });
  el('historyBox').addEventListener('click', e => { const open = e.target.dataset.open; if (!open) return; if (open.startsWith('order')) state.ui.view = 'order'; if (open.startsWith('weekly')) state.ui.view = 'weekly'; if (open.startsWith('prod')) state.ui.view = 'production'; render(); });
}
function init(){
  el('ghOwner').value = state.ui.github.owner || '';
  el('ghRepo').value = state.ui.github.repo || '';
  el('ghBranch').value = state.ui.github.branch || 'main';
  el('ghPath').value = state.ui.github.path || 'data.json';
  el('ghToken').value = state.ui.github.token || '';
  state.ui.date = state.ui.date || new Date().toISOString().slice(0,10);
  bind();
  render();
}
init();
