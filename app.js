// ==================== DATA BASE ====================
const ANO_REF = new Date().getFullYear();
document.getElementById('hdr-year').textContent = ANO_REF;
document.getElementById('hdr-season').textContent = ANO_REF;

const DATA_VERSION = '2026-06-11-v3'; // atualizar aqui a cada nova lista importada

// Carrega do localStorage se houver E versão for igual, senão usa default
let athletes = loadAthletes();

function loadAthletes() {
  try {
    const savedVersion = localStorage.getItem('acquamaster_version');
    const saved = localStorage.getItem('acquamaster_athletes');
    if (saved && savedVersion === DATA_VERSION) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(a => ({...a, age: ANO_REF - a.year}));
    }
  } catch(e) {}
  // versão diferente ou sem dado: usa o default e salva versão atual
  localStorage.setItem('acquamaster_version', DATA_VERSION);
  localStorage.removeItem('acquamaster_athletes');
  return DEFAULT_ATHLETES.map(a => ({...a, age: ANO_REF - a.year}));
}

function saveAthletes(list) {
  try {
    localStorage.setItem('acquamaster_athletes', JSON.stringify(list.map(({age,...a}) => a)));
    localStorage.setItem('acquamaster_version', DATA_VERSION);
  } catch(e) {}
}

// ==================== FILTERS (Atletas) ====================
let filters = { sex:'todos', age:'todos' };
let sortCol = 'name', sortDir = 1;

function setFilter(type, val, btn) {
  filters[type] = val;
  btn.closest('.filter-group').querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterAthletes();
}

function matchAge(age) {
  if (filters.age === 'todos') return true;
  if (filters.age === '30+') return age >= 30;
  if (filters.age === '30-34') return age >= 30 && age <= 34;
  if (filters.age === '35-39') return age >= 35 && age <= 39;
  if (filters.age === '40-44') return age >= 40 && age <= 44;
  if (filters.age === '45-49') return age >= 45 && age <= 49;
  if (filters.age === '50-54') return age >= 50 && age <= 54;
  if (filters.age === '55-59') return age >= 55 && age <= 59;
  if (filters.age === '60+') return age >= 60;
  return true;
}

function filterAthletes() {
  const q = document.querySelector('.search-input').value.toLowerCase();
  let list = athletes.filter(a => {
    if (filters.sex !== 'todos' && a.sex !== filters.sex) return false;
    if (!matchAge(a.age)) return false;
    if (q && !a.name.toLowerCase().includes(q) && !a.club.toLowerCase().includes(q)) return false;
    return true;
  });
  list.sort((a,b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });
  renderTable(list);
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = 1; }
  filterAthletes();
}

function renderTable(list) {
  // deduplica por name+club (o array novo tem entradas únicas, mas por segurança)
  const seen = new Set();
  list = list.filter(a => {
    const k = a.name + '|' + a.club;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  const PROVA_LABELS = {
    1:'800L F',2:'400M M',3:'50C F',4:'50C M',5:'200L F',6:'200L M',
    7:'50B F',8:'50B M',9:'100P F',10:'100P M',11:'50L F',12:'50L M',
    13:'200C F',14:'200C M',15:'50P F',16:'50P M',17:'4x50 Med F',18:'4x50 Med M'
  };

  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  document.getElementById('st-total').textContent = list.length;
  document.getElementById('st-m').textContent = list.filter(a => a.sex === 'M').length;
  document.getElementById('st-f').textContent = list.filter(a => a.sex === 'F').length;
  document.getElementById('st-foz').textContent = list.filter(a => a.club === 'ACQUAMASTER/FOZ').length;
  document.getElementById('st-inscricoes').textContent = list.reduce((n,a) => n + (a.provas||[]).length, 0);
  if (!list.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = list.map((a,i) => {
    const provasBadges = (a.provas||[]).map(p =>
      `<span style="font-family:'DM Mono',monospace;font-size:0.65rem;padding:1px 5px;border-radius:3px;background:rgba(0,212,255,0.08);color:var(--cyan);border:1px solid rgba(0,212,255,0.2);white-space:nowrap;">${PROVA_LABELS[p]||p+'ª'}</span>`
    ).join(' ');
    return `
    <tr>
      <td class="name">${i+1}. ${toTitleCase(a.name)}</td>
      <td class="year">${a.year}</td>
      <td class="age">${a.age}</td>
      <td><span class="${a.sex==='M'?'sex-m':'sex-f'}" style="font-size:0.75rem;">${a.sex}</span></td>
      <td class="club"><span class="badge ${a.club==='ACQUAMASTER/FOZ'?'badge-foz':'badge-other'}">${a.club}</span></td>
      <td style="font-size:0.78rem;">${provasBadges || '<span style="color:var(--muted);font-size:0.72rem;">—</span>'}</td>
    </tr>`;
  }).join('');
}

function toTitleCase(s) {
  const lower = ['DE','DA','DO','DOS','DAS','E','A','O'];
  return s.split(' ').map((w,i) => {
    if (i > 0 && lower.includes(w)) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ==================== ATLETAS — filtrado pelo campeonato selecionado ====================
// Quando um campeonato está aberto (ver campeonatoAtualId em CAMPEONATOS,
// mais abaixo), a aba Atletas mostra todo mundo inscrito nesse evento
// (qualquer clube), em vez do cadastro fixo do clube.
let campAtletasAll = [];
let campAtletaFilters = { sex:'todos', faixa:'todos' };

function renderAtletasSection() {
  const camp = getCampeonatoAtual();
  const rosterView = document.getElementById('atletasRosterView');
  const campView = document.getElementById('atletasCampView');
  if (camp) {
    rosterView.style.display = 'none';
    campView.style.display = 'block';
    document.getElementById('campCtxNome').textContent = camp.nome;
    campAtletaFilters = { sex:'todos', faixa:'todos' };
    campAtletasAll = buildAtletasFromCampeonato(camp);
    renderCampAtletasFilterBar();
    filterCampAtletas();
  } else {
    rosterView.style.display = 'block';
    campView.style.display = 'none';
  }
}

function clearSelectedCampeonato() {
  campeonatoAtualId = null;
  renderAtletasSection();
}

function buildAtletasFromCampeonato(camp) {
  const map = new Map();
  (camp.provas||[]).forEach(prova => {
    const sex = /feminino/i.test(prova.nome) ? 'F' : /masculino/i.test(prova.nome) ? 'M' : null;
    (prova.series||[]).forEach(serie => {
      (serie.atletas||[]).forEach(a => {
        const key = a.matr || (a.nome + '|' + a.clube);
        if (!map.has(key)) map.set(key, { matr:a.matr, nome:a.nome, clube:a.clube, faixa:a.faixa, sex, provas:[] });
        const entry = map.get(key);
        if (!entry.faixa && a.faixa) entry.faixa = a.faixa;
        if (!entry.sex && sex) entry.sex = sex;
        if (!entry.provas.some(p => p.num === prova.num)) entry.provas.push({ num:prova.num, nome:prova.nome });
      });
    });
  });
  return [...map.values()];
}

function renderCampAtletasFilterBar() {
  const faixas = [...new Set(campAtletasAll.map(a => a.faixa).filter(Boolean))]
    .sort((a,b) => (parseInt(a,10)||0) - (parseInt(b,10)||0));
  document.getElementById('campAtletasFilterBar').innerHTML = `
    <span class="filter-label">Sexo</span>
    <div class="filter-group">
      <button class="filter-chip ${campAtletaFilters.sex==='todos'?'active':''}" onclick="setCampAtletaFilter('sex','todos',this)">Todos</button>
      <button class="filter-chip ${campAtletaFilters.sex==='M'?'active':''}" onclick="setCampAtletaFilter('sex','M',this)">Masculino</button>
      <button class="filter-chip ${campAtletaFilters.sex==='F'?'active':''}" onclick="setCampAtletaFilter('sex','F',this)">Feminino</button>
    </div>
    <div class="filter-sep"></div>
    <span class="filter-label">Faixa</span>
    <div class="filter-group">
      <button class="filter-chip ${campAtletaFilters.faixa==='todos'?'active':''}" onclick="setCampAtletaFilter('faixa','todos',this)">Todas</button>
      ${faixas.map(f => `<button class="filter-chip ${campAtletaFilters.faixa===f?'active':''}" onclick="setCampAtletaFilter('faixa','${escAttr(f)}',this)">${escAttr(f)}</button>`).join('')}
    </div>
    <div class="filter-sep"></div>
    <input class="search-input" type="text" id="campAtletaSearch" placeholder="Buscar atleta ou clube..." oninput="filterCampAtletas()">
  `;
}

function setCampAtletaFilter(type, val, btn) {
  campAtletaFilters[type] = val;
  btn.closest('.filter-group').querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterCampAtletas();
}

function filterCampAtletas() {
  const q = (document.getElementById('campAtletaSearch')?.value || '').toLowerCase();
  let list = campAtletasAll.filter(a => {
    if (campAtletaFilters.sex !== 'todos' && a.sex !== campAtletaFilters.sex) return false;
    if (campAtletaFilters.faixa !== 'todos' && a.faixa !== campAtletaFilters.faixa) return false;
    if (q && !a.nome.toLowerCase().includes(q) && !a.clube.toLowerCase().includes(q)) return false;
    return true;
  });
  list.sort((a,b) => a.nome.localeCompare(b.nome));
  renderCampAtletasTable(list);
}

function renderCampAtletasTable(list) {
  document.getElementById('campAtletasStats').innerHTML = `
    <div class="stat-card"><div class="stat-val">${list.length}</div><div class="stat-lbl">Total filtrado</div></div>
    <div class="stat-card"><div class="stat-val">${list.filter(a=>a.sex==='M').length}</div><div class="stat-lbl">Masculino</div></div>
    <div class="stat-card"><div class="stat-val">${list.filter(a=>a.sex==='F').length}</div><div class="stat-lbl">Feminino</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--cyan)">${list.filter(a=>a.clube===FOZ_CLUB).length}</div><div class="stat-lbl">AcquaMaster/FOZ</div></div>
  `;
  const tbody = document.getElementById('campAtletasTbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted);">Nenhum atleta encontrado com os filtros aplicados.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((a,i) => {
    const isFoz = a.clube === FOZ_CLUB;
    const provasBadges = a.provas.map(p =>
      `<span title="${escAttr(p.nome)}" style="font-family:'DM Mono',monospace;font-size:0.65rem;padding:1px 5px;border-radius:3px;background:rgba(0,212,255,0.08);color:var(--cyan);border:1px solid rgba(0,212,255,0.2);white-space:nowrap;">${p.num}ª</span>`
    ).join(' ');
    return `
    <tr>
      <td class="name">${i+1}. ${toTitleCase(a.nome)}</td>
      <td class="year">${a.matr ?? '—'}</td>
      <td><span class="bal-faixa">${escAttr(a.faixa || '—')}</span></td>
      <td><span class="${a.sex==='M'?'sex-m':'sex-f'}" style="font-size:0.75rem;">${a.sex || '—'}</span></td>
      <td class="club"><span class="badge ${isFoz?'badge-foz':'badge-other'}">${escAttr(a.clube)}</span></td>
      <td style="font-size:0.78rem;">${provasBadges}</td>
    </tr>`;
  }).join('');
}

// ==================== CHART (Evolução — aba oculta por enquanto) ====================
const provas = {
  peito50:{ label:'50m Peito', metrics:{record:'41.61',evento:'1º · Londrina mai/26',melhora:'−4.0s vs mar/25'},
    sets:[
      {label:'25m',color:'#0089b3',dash:[],pts:[{x:'06/2024',y:110.20},{x:'03/2025',y:42.60},{x:'06/2025',y:45.80},{x:'05/2026',y:41.61}]},
      {label:'50m',color:'#047857',dash:[5,4],pts:[{x:'08/2024',y:46.20},{x:'08/2025',y:44.06}]}
    ], note:'Prova principal. Recorde pessoal de 41.61s em mai/2026 (1º lugar). Evolução consistente tanto no 25m quanto no 50m.'},
  livre50:{ label:'50m Livre', metrics:{record:'38.34',evento:'8º · Curitiba mar/25',melhora:'−2.1s vs jun/24'},
    sets:[
      {label:'25m',color:'#0089b3',dash:[],pts:[{x:'06/2024',y:40.41},{x:'03/2025',y:38.34}]},
      {label:'50m',color:'#047857',dash:[5,4],pts:[{x:'08/2024',y:39.89},{x:'08/2025',y:39.02}]}
    ], note:'Record pessoal de 38.34 (25m, mar/2025). No 50m melhora gradual: 39.89 → 39.02. DQL em set/2025 não computada.'},
  peito100:{ label:'100m Peito', metrics:{record:'1:45.07',evento:'2º · Curitiba ago/25',melhora:'−5.1s (50m)'},
    sets:[
      {label:'25m',color:'#0089b3',dash:[],pts:[{x:'06/2024',y:110.20},{x:'06/2025',y:107.00},{x:'11/2025',y:110.65},{x:'05/2026',y:117.44}]},
      {label:'50m',color:'#047857',dash:[5,4],pts:[{x:'08/2025',y:105.07}]}
    ], note:'Melhor 25m: 1:47.00 (jun/2025). Recorde no 50m: 1:45.07 (ago/2025). Prova com maior número de 2º lugares.'},
  livre100:{ label:'100m Livre', metrics:{record:'1:29.69',evento:'5º · Floripa set/25',melhora:'−7.7s vs 2024'},
    sets:[
      {label:'25m',color:'#0089b3',dash:[],pts:[{x:'09/2024',y:97.35},{x:'04/2025',y:106.71},{x:'09/2025',y:89.69}]},
      {label:'50m',color:'#047857',dash:[5,4],pts:[{x:'08/2024',y:97.33}]}
    ], note:'Salto expressivo: 1:37 → 1:29 no 25m entre 2024 e set/2025. Maior melhora percentual registrada.'},
  peito200:{ label:'200m Peito', metrics:{record:'3:54.37',evento:'2º · Londrina abr/25',melhora:'2 provas'},
    sets:[{label:'25m',color:'#0089b3',dash:[],pts:[{x:'04/2025',y:234.37},{x:'05/2026',y:237.44}]}],
    note:'Disputada apenas 2x, ambas com 2º lugar e tempos bem próximos (~3:54/3:57). Consistência elevada.'}
};

let currentChart = null, activeProva = 'peito50';

function buildProvaTabs() {
  document.getElementById('provaTabs').innerHTML = Object.entries(provas).map(([k,v]) =>
    `<button class="prova-tab ${k===activeProva?'active':''}" onclick="selectProva('${k}',this)">${v.label}</button>`).join('');
}

function selectProva(key, btn) {
  activeProva = key;
  document.querySelectorAll('.prova-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChart(key);
}

function renderChart(key) {
  const p = provas[key];
  document.getElementById('chartMetrics').innerHTML = `
    <div class="cmetric"><div class="cm-val">${p.metrics.record}</div><div class="cm-lbl">Recorde pessoal</div><div class="cm-sub">${p.metrics.evento}</div></div>
    <div class="cmetric"><div class="cm-val" style="color:var(--green)">${p.metrics.melhora}</div><div class="cm-lbl">Evolução</div><div class="cm-sub">vs. primeira marca</div></div>
    <div class="cmetric"><div class="cm-val">${p.sets.reduce((a,s)=>a+s.pts.length,0)}</div><div class="cm-lbl">Marcas registradas</div><div class="cm-sub">nas duas piscinas</div></div>`;
  document.getElementById('chartLegend').innerHTML = p.sets.map(s =>
    `<div class="legend-item"><div class="legend-dot" style="background:${s.color}; ${s.dash.length?'opacity:0.5':''}"></div>${s.label}</div>`).join('');
  document.getElementById('chartNote').textContent = p.note;

  const allLabels = [...new Set(p.sets.flatMap(s => s.pts.map(pt => pt.x)))].sort((a,b) => {
    const [am,ay]=a.split('/'); const [bm,by]=b.split('/');
    return (+ay*12 + +am) - (+by*12 + +bm);
  });
  const datasets = p.sets.map(s => ({
    label:s.label, data:allLabels.map(l => { const pt=s.pts.find(p=>p.x===l); return pt?pt.y:null; }),
    borderColor:s.color, backgroundColor:s.color+'18', borderDash:s.dash, borderWidth:2.5,
    pointRadius:6, pointBackgroundColor:s.color, pointHoverRadius:8, tension:0.35, spanGaps:false
  }));

  if (currentChart) currentChart.destroy();
  currentChart = new Chart(document.getElementById('evoChart'), {
    type:'line', data:{ labels:allLabels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{
        backgroundColor:'#ffffff', borderColor:'rgba(23,32,51,0.15)', borderWidth:1,
        titleColor:'#0089b3', bodyColor:'#5b6b84',
        callbacks:{ label: ctx => {
          const v=ctx.raw; if(v===null) return '';
          const m=Math.floor(v/60); const s=(v%60).toFixed(2);
          return ` ${ctx.dataset.label}: ${m>0?m+':'+s.padStart(5,'0'):s+'s'}`;
        }}
      }},
      scales:{
        x:{ grid:{color:'rgba(23,32,51,0.06)'}, ticks:{color:'#5b6b84',font:{size:11,family:'DM Mono'}} },
        y:{ reverse:true, grid:{color:'rgba(23,32,51,0.06)'}, ticks:{
          color:'#5b6b84', font:{size:11,family:'DM Mono'},
          callback: v => { const m=Math.floor(v/60); const s=(v%60).toFixed(0); return m>0?m+':'+String(s).padStart(2,'0'):s+'s'; }
        }}
      }
    }
  });
}

// ==================== CAMPEONATOS ====================
const FOZ_CLUB = 'ACQUAMASTER/FOZ';
const MY_MATR = 129122;
const CAMPEONATOS_KEY = 'acquamaster_campeonatos_v1';

// Fonte da verdade é o banco (Postgres, via /api/campeonatos) — compartilhado entre
// todos os colegas. O localStorage vira só uma cópia de emergência pra quando o
// servidor estiver fora do ar (o painel continua funcionando, só que sem sincronizar).
async function fetchCampeonatos() {
  try {
    const res = await fetch('/api/campeonatos');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('resposta inválida do servidor');
    if (data.length === 0) {
      // banco vazio (primeiro deploy): se este navegador já tinha campeonatos
      // salvos localmente, publica pro servidor pra virar o dado compartilhado.
      const cached = loadCampeonatosCache();
      if (cached.length) {
        campeonatos = cached;
        saveCampeonatos();
        return campeonatos;
      }
    }
    campeonatos = data;
    saveCampeonatosCache(data);
    return data;
  } catch (e) {
    console.error('Não foi possível carregar campeonatos do servidor, usando cópia local:', e);
    campeonatos = loadCampeonatosCache();
    return campeonatos;
  }
}

function loadCampeonatosCache() {
  try {
    const saved = localStorage.getItem(CAMPEONATOS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch(e) {}
  // sem servidor e sem cópia local: usa o histórico embutido no código como ponto de partida
  return [{
    id: 'seed-3etapa-2026',
    nome: EVENTO.nome, data: EVENTO.data, local: EVENTO.local, piscina: EVENTO.piscina,
    provas: PROVAS_BAL
  }];
}

function saveCampeonatosCache(list) {
  try { localStorage.setItem(CAMPEONATOS_KEY, JSON.stringify(list)); } catch(e) {}
}

async function saveCampeonatos() {
  saveCampeonatosCache(campeonatos);
  try {
    const res = await fetch('/api/campeonatos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campeonatos)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (e) {
    console.error('Falha ao salvar campeonatos no servidor:', e);
    alert('Não foi possível salvar no servidor — suas alterações podem não aparecer para os colegas. Verifique sua conexão e tente novamente.');
  }
}

let campeonatos = [];
let campeonatoAtualId = null;
let campeonatosPromise = fetchCampeonatos();
let balFozOnly = true;
let balAllCollapsed = true;
let pdfReview = null; // { provas, warnings } em edição, antes de salvar

function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function maskDateBR(el) {
  const digits = el.value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) el.value = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
  else if (digits.length > 2) el.value = digits.slice(0,2) + '/' + digits.slice(2);
  else el.value = digits;
}

function brDateSortKey(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  return m ? m[3]+m[2]+m[1] : '00000000';
}

function campStats(camp) {
  let totalAtletas = 0, totalFoz = 0, totalProvas = 0;
  (camp.provas||[]).forEach(p => {
    let hasAny = false;
    (p.series||[]).forEach(s => (s.atletas||[]).forEach(a => {
      totalAtletas++; hasAny = true;
      if (a.clube === FOZ_CLUB) totalFoz++;
    }));
    if (hasAny) totalProvas++;
  });
  return { totalAtletas, totalFoz, totalProvas };
}

function renderBalizamentoSection() {
  if (campeonatoAtualId && campeonatos.find(c => c.id === campeonatoAtualId)) {
    document.getElementById('balListView').style.display = 'none';
    document.getElementById('balDetailView').style.display = 'block';
    renderCampeonatoDetail();
  } else {
    campeonatoAtualId = null;
    document.getElementById('balListView').style.display = 'block';
    document.getElementById('balDetailView').style.display = 'none';
    renderCampGrid();
  }
}

function renderCampGrid() {
  const grid = document.getElementById('campGrid');
  if (!campeonatos.length) {
    grid.innerHTML = `<div class="camp-empty" style="grid-column:1/-1"><span>🏆</span>Nenhum campeonato cadastrado ainda. Clique em "＋ Novo campeonato" pra começar.</div>`;
    return;
  }
  const sorted = [...campeonatos].sort((a,b) => brDateSortKey(b.data).localeCompare(brDateSortKey(a.data)));
  grid.innerHTML = sorted.map(c => {
    const { totalAtletas, totalFoz, totalProvas } = campStats(c);
    return `
    <div class="camp-card" onclick="openCampeonato('${c.id}')">
      <button class="camp-del" title="Excluir campeonato" onclick="event.stopPropagation();deleteCampeonato('${c.id}')">🗑</button>
      <h3>${escAttr(c.nome)}</h3>
      <div class="camp-meta">
        <span>📅 ${escAttr(c.data || '—')}</span>
        <span>📍 ${escAttr(c.local || '—')}</span>
        ${c.piscina ? `<span>🏊 ${escAttr(c.piscina)}</span>` : ''}
      </div>
      <div class="camp-counts">
        <span class="badge badge-other">${totalProvas} provas</span>
        <span class="badge badge-other">${totalAtletas} inscrições</span>
        ${totalFoz ? `<span class="badge badge-foz">⭐ ${totalFoz} FOZ</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openNewCampeonatoModal() {
  const html = `
    <div class="modal-overlay" id="campModal" onclick="if(event.target===this) closeModal()">
      <div class="modal-box">
        <h3>🏆 Novo campeonato</h3>
        <div class="modal-field"><label>Nome do campeonato</label><input id="cmNome" placeholder="Ex: Meeting PR/SC Masters 4ª Etapa"></div>
        <div class="modal-field"><label>Data (DD/MM/AAAA)</label><input id="cmData" placeholder="20/06/2026" maxlength="10" oninput="maskDateBR(this)"></div>
        <div class="modal-field"><label>Local</label><input id="cmLocal" placeholder="Ex: Country Clube de Maringá — Maringá/PR"></div>
        <div class="modal-field"><label>Piscina</label><input id="cmPiscina" placeholder="Ex: 25m · 7 raias"></div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="createCampeonato()">Criar campeonato</button>
          <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('cmNome').focus();
}

function closeModal() {
  const m = document.getElementById('campModal');
  if (m) m.remove();
}

function createCampeonato() {
  const nome = document.getElementById('cmNome').value.trim();
  const data = document.getElementById('cmData').value.trim();
  const local = document.getElementById('cmLocal').value.trim();
  const piscina = document.getElementById('cmPiscina').value.trim();
  if (!nome) { alert('Informe o nome do campeonato.'); return; }
  const camp = { id: uid(), nome, data, local, piscina, provas: [] };
  campeonatos.push(camp);
  saveCampeonatos();
  closeModal();
  campeonatoAtualId = camp.id;
  renderBalizamentoSection();
}

function deleteCampeonato(id) {
  const camp = campeonatos.find(c => c.id === id);
  if (!camp) return;
  if (!confirm(`Excluir o campeonato "${camp.nome}"? Essa ação não pode ser desfeita.`)) return;
  campeonatos = campeonatos.filter(c => c.id !== id);
  saveCampeonatos();
  if (campeonatoAtualId === id) campeonatoAtualId = null;
  renderBalizamentoSection();
}

function deleteCampeonatoAtual() {
  if (campeonatoAtualId) deleteCampeonato(campeonatoAtualId);
}

function openCampeonato(id) {
  campeonatoAtualId = id;
  balFozOnly = true; balAllCollapsed = true; pdfReview = null;
  renderBalizamentoSection();
}

function closeCampeonatoDetail() {
  campeonatoAtualId = null;
  pdfReview = null;
  renderBalizamentoSection();
}

function getCampeonatoAtual() {
  return campeonatos.find(c => c.id === campeonatoAtualId);
}

function renderCampeonatoDetail() {
  const camp = getCampeonatoAtual();
  if (!camp) { renderBalizamentoSection(); return; }

  document.getElementById('balHeaderInfo').innerHTML = `
    <div class="bal-info-item"><span>Competição</span><strong>${escAttr(camp.nome)}</strong></div>
    <div class="bal-info-item"><span>Data</span><strong>${escAttr(camp.data || '—')}</strong></div>
    <div class="bal-info-item"><span>Local</span><strong>${escAttr(camp.local || '—')}</strong></div>
    ${camp.piscina ? `<div class="bal-info-item"><span>Piscina</span><strong>${escAttr(camp.piscina)}</strong></div>` : ''}
  `;

  const filterSel = document.getElementById('balProvaFilter');
  const currentVal = filterSel.value;
  filterSel.innerHTML = '<option value="">Todas as provas</option>' +
    (camp.provas||[]).map(p => `<option value="${p.num}">${p.num}ª — ${escAttr(p.nome)}</option>`).join('');
  filterSel.value = currentVal;

  if (pdfReview) {
    document.getElementById('balBrowse').style.display = 'none';
    document.getElementById('balPdfImport').style.display = 'block';
    renderPdfImportUI();
  } else {
    document.getElementById('balBrowse').style.display = 'block';
    document.getElementById('balPdfImport').style.display = 'none';
    renderBalizamento();
  }
}

function toggleFozOnly(btn) {
  balFozOnly = !balFozOnly;
  btn.classList.toggle('active', balFozOnly);
  renderBalizamento();
}

function toggleAllProvas(btn) {
  balAllCollapsed = !balAllCollapsed;
  btn.textContent = balAllCollapsed ? '⊟ Recolher tudo' : '⊞ Expandir tudo';
  document.querySelectorAll('.prova-block').forEach(b => b.classList.toggle('collapsed', balAllCollapsed));
}

function renderBalizamento() {
  const camp = getCampeonatoAtual();
  if (!camp) return;
  const q = (document.getElementById('balSearch')?.value || '').toLowerCase();
  const provaFilter = document.getElementById('balProvaFilter')?.value || '';
  const container = document.getElementById('balContainer');

  const { totalAtletas, totalFoz, totalProvas } = campStats(camp);
  document.getElementById('balStats').innerHTML = `
    <div class="stat-card"><div class="stat-val">${totalProvas}</div><div class="stat-lbl">Provas</div></div>
    <div class="stat-card"><div class="stat-val">${totalAtletas}</div><div class="stat-lbl">Inscrições</div></div>
    <div class="stat-card"><div class="stat-val" style="color:var(--cyan)">${totalFoz}</div><div class="stat-lbl">AcquaMaster/FOZ</div></div>
    <div class="stat-card"><div class="stat-val">${escAttr(camp.data || '—')}</div><div class="stat-lbl">Data</div></div>
  `;

  let html = '';
  (camp.provas||[]).forEach(prova => {
    if (provaFilter && String(prova.num) !== provaFilter) return;

    const provaFiltered = (prova.series||[]).map(s => ({
      ...s,
      atletas: (s.atletas||[]).filter(a => {
        if (balFozOnly && a.clube !== FOZ_CLUB) return false;
        if (q && !a.nome.toLowerCase().includes(q) && !a.clube.toLowerCase().includes(q)) return false;
        return true;
      })
    })).filter(s => s.atletas.length > 0);

    if (provaFiltered.length === 0) return;

    const fozCount = provaFiltered.reduce((n, s) => n + s.atletas.filter(a => a.clube === FOZ_CLUB).length, 0);
    const forceOpen = provaFilter !== '';

    html += `
    <div class="prova-block ${(balAllCollapsed && !forceOpen) ? 'collapsed' : ''}" id="pb-${prova.num}">
      <div class="prova-block-header" onclick="toggleProva(${prova.num})">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="prova-num">${prova.num}ª Prova</span>
          <span class="prova-name">${escAttr(prova.nome)}</span>
        </div>
        <div class="prova-meta">
          ${fozCount ? `<span class="prova-foz-count">⭐ ${fozCount} da FOZ</span>` : ''}
          ${prova.horario ? `<span class="prova-time">🕐 ${prova.horario}</span>` : ''}
          ${prova.termino ? `<span class="prova-time">→ ${prova.termino}</span>` : ''}
          <span class="prova-chevron">▼</span>
        </div>
      </div>
      <div class="prova-body">`;

    provaFiltered.forEach(serie => {
      html += `
        <div class="serie-block">
          <div class="serie-label">
            <span>${serie.serie}ª Série</span>
            ${serie.horario ? `<span>🕐 ${serie.horario}</span>` : ''}
          </div>
          <table class="bal-table">`;
      serie.atletas.forEach(a => {
        const isFoz = a.clube === FOZ_CLUB;
        const isMe = a.matr === MY_MATR;
        const rowClass = isMe ? 'highlight-row' : (isFoz ? 'foz-row' : '');
        const idx = { prova: prova.num, serie: serie.serie, raia: a.raia, matr: a.matr };
        html += `
            <tr class="${rowClass}">
              <td class="raia-num">${a.raia}</td>
              <td class="bal-atleta">${toTitleCase(a.nome)}${isMe ? ' <span style="color:var(--amber);font-size:0.7rem">★ você</span>' : ''}<span class="matr">#${a.matr}</span></td>
              <td><span class="bal-faixa">${escAttr(a.faixa)}</span></td>
              <td class="bal-clube"><span class="badge ${isFoz ? 'badge-foz' : 'badge-other'}">${escAttr(a.clube)}</span></td>
              <td class="bal-tempo ${a.tempo === 'S/T' ? 'st' : ''}">${escAttr(a.tempo)}</td>
              <td><button class="bal-edit-btn" onclick='openEditAthlete(${JSON.stringify(idx)})'>✏</button></td>
            </tr>`;
      });
      html += `</table></div>`;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html || `<div class="no-results-bal">🏊 Nenhum atleta encontrado com os filtros aplicados.</div>`;
}

function toggleProva(num) {
  document.getElementById('pb-' + num).classList.toggle('collapsed');
}

function findAthlete(camp, idx) {
  const prova = (camp.provas||[]).find(p => p.num === idx.prova);
  if (!prova) return null;
  const serie = (prova.series||[]).find(s => s.serie === idx.serie);
  if (!serie) return null;
  const atleta = (serie.atletas||[]).find(a => a.raia === idx.raia && a.matr === idx.matr);
  return atleta ? { atleta, prova, serie } : null;
}

function openEditAthlete(idx) {
  const camp = getCampeonatoAtual();
  const found = camp && findAthlete(camp, idx);
  if (!found) return;
  const a = found.atleta;
  const html = `
    <div class="modal-overlay" id="editAthleteModal" onclick="if(event.target===this) closeEditAthlete()">
      <div class="modal-box">
        <h3>✏ Corrigir inscrição</h3>
        <div class="modal-field"><label>Raia</label><input id="eaRaia" value="${escAttr(a.raia)}"></div>
        <div class="modal-field"><label>Matrícula</label><input id="eaMatr" value="${escAttr(a.matr)}"></div>
        <div class="modal-field"><label>Faixa</label><input id="eaFaixa" value="${escAttr(a.faixa)}"></div>
        <div class="modal-field"><label>Nome</label><input id="eaNome" value="${escAttr(a.nome)}"></div>
        <div class="modal-field"><label>Clube</label><input id="eaClube" value="${escAttr(a.clube)}"></div>
        <div class="modal-field"><label>Tempo</label><input id="eaTempo" value="${escAttr(a.tempo)}"></div>
        <div class="modal-actions">
          <button class="btn-primary" onclick='saveEditAthlete(${JSON.stringify(idx)})'>💾 Salvar</button>
          <button class="btn-secondary" onclick="closeEditAthlete()">Cancelar</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeEditAthlete() {
  const m = document.getElementById('editAthleteModal');
  if (m) m.remove();
}

function saveEditAthlete(idx) {
  const camp = getCampeonatoAtual();
  const found = camp && findAthlete(camp, idx);
  if (!found) return;
  const a = found.atleta;
  a.raia = parseInt(document.getElementById('eaRaia').value, 10) || a.raia;
  a.matr = parseInt(document.getElementById('eaMatr').value, 10) || a.matr;
  a.faixa = document.getElementById('eaFaixa').value.trim();
  a.nome = document.getElementById('eaNome').value.trim().toUpperCase();
  a.clube = document.getElementById('eaClube').value.trim().toUpperCase();
  a.tempo = document.getElementById('eaTempo').value.trim();
  saveCampeonatos();
  closeEditAthlete();
  renderBalizamento();
}

// ==================== IMPORT BALIZAMENTO (PDF) ====================
function openPdfImport() {
  pdfReview = { stage: 'idle' };
  renderCampeonatoDetail();
}

function cancelPdfImport() {
  pdfReview = null;
  renderCampeonatoDetail();
}

function renderPdfImportUI() {
  const el = document.getElementById('balPdfImport');
  if (pdfReview.stage === 'idle') {
    el.innerHTML = `
      <div class="import-card">
        <h3>📄 Importar balizamento (PDF)</h3>
        <p>O PDF do balizamento não tem texto selecionável (é desenhado como imagem pelo sistema da federação), então cada página é renderizada e passa por reconhecimento óptico de caracteres (OCR) no seu navegador. Pode levar alguns minutos dependendo do número de páginas. Depois você revisa tudo antes de salvar.</p>
        <div class="drop-zone" id="pdfDropZone">
          <input type="file" id="pdfFileInput" accept=".pdf" onchange="handlePdfFile(this.files[0])">
          <span class="dz-icon">📄</span>
          <div class="dz-text">Arraste o PDF do balizamento aqui ou clique para selecionar</div>
          <div class="dz-sub">.pdf</div>
        </div>
        <div style="margin-top:1rem;"><button class="btn-secondary" onclick="cancelPdfImport()">✕ Cancelar</button></div>
      </div>`;
    const dz = document.getElementById('pdfDropZone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag-over');
      const f = e.dataTransfer.files[0]; if (f) handlePdfFile(f);
    });
  } else if (pdfReview.stage === 'processing') {
    el.innerHTML = `
      <div class="import-card">
        <h3>⏳ Processando PDF…</h3>
        <p id="pdfProgressText">${escAttr(pdfReview.statusText || 'Iniciando…')}</p>
        <div class="progress-bar-wrap" style="display:block;"><div class="progress-bar" id="pdfProgressBar" style="width:${pdfReview.progressPct||0}%"></div></div>
      </div>`;
  } else if (pdfReview.stage === 'error') {
    el.innerHTML = `
      <div class="import-card">
        <h3>❌ Erro ao processar PDF</h3>
        <div class="alert-box alert-error">${escAttr(pdfReview.error)}</div>
        <button class="btn-secondary" onclick="cancelPdfImport()">✕ Fechar</button>
      </div>`;
  } else if (pdfReview.stage === 'review') {
    renderPdfReviewTable(el);
  }
}

async function handlePdfFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) { alert('Selecione um arquivo .pdf'); return; }

  pdfReview = { stage: 'processing', statusText: 'Carregando PDF…', progressPct: 0 };
  renderPdfImportUI();

  try {
    const result = await parseBalizamentoPDF(file, {
      onProgress: info => {
        if (info.stage === 'render') {
          pdfReview.statusText = `Renderizando página ${info.page} de ${info.totalPages}…`;
          pdfReview.progressPct = Math.round(((info.page - 1) / info.totalPages) * 100);
        } else if (info.stage === 'ocr-start') {
          pdfReview.statusText = `Lendo página ${info.page} de ${info.totalPages} (OCR)…`;
        } else if (info.stage === 'ocr') {
          const base = ((pdfReview._page || 1) - 1);
          pdfReview.progressPct = Math.round(((info.progress || 0)) * 100);
        }
        const bar = document.getElementById('pdfProgressBar');
        const txt = document.getElementById('pdfProgressText');
        if (bar) bar.style.width = pdfReview.progressPct + '%';
        if (txt) txt.textContent = pdfReview.statusText;
      }
    });
    pdfReview = { stage: 'review', provas: result.provas, warnings: result.warnings };
    renderCampeonatoDetail();
  } catch (err) {
    pdfReview = { stage: 'error', error: err.message || String(err) };
    renderCampeonatoDetail();
  }
}

function athleteTag(a) {
  const problems = [];
  if (!a.matr) problems.push('matrícula');
  if (!a.nome) problems.push('nome');
  if (!a.clube) problems.push('clube');
  if (!/^(S\/T|\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})$/.test(a.tempo || '')) problems.push('tempo');
  return problems;
}

function renderPdfReviewTable(el) {
  const provasData = pdfReview.provas;
  let totalAtletas = 0, totalWarn = 0;
  provasData.forEach(p => p.series.forEach(s => s.atletas.forEach(a => {
    totalAtletas++;
    if (athleteTag(a).length) totalWarn++;
  })));

  let html = `
    <div class="import-card">
      <div class="preview-header">
        <h3>✅ Revisão do balizamento extraído</h3>
      </div>
      <p>Confira principalmente as linhas marcadas em amarelo — o OCR costuma confundir dígitos parecidos (ex: "7" com "T"). Edite direto nos campos abaixo antes de confirmar.</p>
      <div class="pdf-parse-summary">
        <span class="tag-ok">✅ ${provasData.length} provas · ${totalAtletas} inscrições</span>
        ${totalWarn ? `<span class="tag-warn">⚠ ${totalWarn} linhas pra revisar</span>` : ''}
        ${pdfReview.warnings.length ? `<span class="tag-err">✕ ${pdfReview.warnings.length} linhas não reconhecidas</span>` : ''}
      </div>`;

  if (pdfReview.warnings.length) {
    html += `<div class="import-log">${pdfReview.warnings.map(w =>
      `<span class="log-err">Prova ${w.prova}${w.serie?', série '+w.serie:''}: "${escAttr(w.raw)}" — ${w.problems.join(', ')}</span>`
    ).join('\n')}</div>`;
  }

  provasData.forEach((p, pi) => {
    html += `
      <div class="prova-block" style="margin-top:1rem;" id="pb-review-${p.num}">
        <div class="prova-block-header" onclick="toggleProva('review-${p.num}')">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span class="prova-num">${p.num}ª Prova</span>
            <span class="prova-name">${escAttr(p.nome)}</span>
          </div>
          <span class="prova-chevron">▼</span>
        </div>
        <div class="prova-body">`;
    p.series.forEach((s, si) => {
      html += `<div class="serie-block"><div class="serie-label"><span>${s.serie}ª Série</span>${s.horario?`<span>🕐 ${s.horario}</span>`:''}</div>
        <div style="overflow-x:auto;"><table class="bal-edit-table">
        <thead><tr><td>Raia</td><td>Matr.</td><td>Faixa</td><td>Nome</td><td>Clube</td><td>Tempo</td><td></td></tr></thead><tbody>`;
      s.atletas.forEach((a, ai) => {
        const problems = athleteTag(a);
        const path = `${pi},${si},${ai}`;
        html += `<tr class="${problems.length?'row-warn':''}">
          <td><input value="${escAttr(a.raia ?? '')}" onchange="updateReviewField('${path}','raia',this.value)"></td>
          <td><input value="${escAttr(a.matr ?? '')}" onchange="updateReviewField('${path}','matr',this.value)"></td>
          <td><input value="${escAttr(a.faixa)}" onchange="updateReviewField('${path}','faixa',this.value)"></td>
          <td><input value="${escAttr(a.nome)}" onchange="updateReviewField('${path}','nome',this.value)"></td>
          <td><input value="${escAttr(a.clube)}" onchange="updateReviewField('${path}','clube',this.value)"></td>
          <td><input value="${escAttr(a.tempo)}" onchange="updateReviewField('${path}','tempo',this.value)"></td>
          <td class="row-tag">${problems.length ? '<span class="tag-warn">⚠</span>' : '<span class="tag-ok">✓</span>'}</td>
        </tr>`;
      });
      html += `</tbody></table></div></div>`;
    });
    html += `</div></div>`;
  });

  html += `
      <div style="display:flex; gap:10px; margin-top:1.2rem; flex-wrap:wrap;">
        <button class="btn-primary" onclick="confirmPdfImport()">✅ Confirmar e salvar campeonato</button>
        <button class="btn-danger" onclick="cancelPdfImport()">✕ Descartar</button>
      </div>
    </div>`;
  el.innerHTML = html;
}

function updateReviewField(path, field, value) {
  const [pi, si, ai] = path.split(',').map(Number);
  const a = pdfReview.provas[pi].series[si].atletas[ai];
  if (field === 'raia' || field === 'matr') a[field] = parseInt(value, 10) || null;
  else if (field === 'clube' || field === 'nome') a[field] = value.trim().toUpperCase();
  else a[field] = value.trim();
}

function confirmPdfImport() {
  const camp = getCampeonatoAtual();
  if (!camp) return;
  if (!confirm('Salvar este balizamento no campeonato? Isso substitui os dados de provas já existentes nele.')) return;
  camp.provas = pdfReview.provas;
  saveCampeonatos();
  pdfReview = null;
  renderCampeonatoDetail();
}

// ==================== NAV ====================
function switchTab(tab, btn) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('sec-'+tab).classList.add('active');
  if (tab === 'evolucao' && !currentChart) renderChart(activeProva);
  if (tab === 'balizamento') {
    if (campeonatosPromise) {
      document.getElementById('balListView').style.display = 'block';
      document.getElementById('balDetailView').style.display = 'none';
      document.getElementById('campGrid').innerHTML = `<div class="camp-empty" style="grid-column:1/-1">Carregando campeonatos…</div>`;
      campeonatosPromise.then(() => { campeonatosPromise = null; renderBalizamentoSection(); });
    } else {
      renderBalizamentoSection();
    }
  }
  if (tab === 'atletas') renderAtletasSection();
}

// ==================== IMPORT (Excel — atletas) ====================
let parsedRows = [];
let rawHeaders = [];

// Drag & drop visual
const dz = document.getElementById('dropZone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if(f) handleFile(f); });

function handleFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) {
    showAlert('fileAlert','Formato inválido. Use .xlsx, .xls ou .csv','error'); return;
  }
  showProgress(true);
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {type:'binary'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if (json.length < 2) { showAlert('fileAlert','Planilha vazia ou sem dados.','error'); showProgress(false); return; }
      rawHeaders = json[0].map(h => String(h).trim());
      parsedRows = json.slice(1).filter(r => r.some(c => c !== ''));
      showProgress(false);
      showAlert('fileAlert', `✅ Arquivo carregado: <strong>${file.name}</strong> — ${parsedRows.length} linhas encontradas.`, 'success');
      buildColMap();
    } catch(err) {
      showProgress(false);
      showAlert('fileAlert', 'Erro ao ler o arquivo: ' + err.message, 'error');
    }
  };
  reader.readAsBinaryString(file);
}

function buildColMap() {
  const grid = document.getElementById('colMapGrid');
  const fields = [
    { key:'name', label:'Nome do atleta' },
    { key:'year', label:'Ano de nascimento' },
    { key:'sex',  label:'Sexo (M/F)' },
    { key:'club', label:'Clube' }
  ];
  // auto-detect
  const autoMap = {};
  rawHeaders.forEach((h, i) => {
    const hl = h.toLowerCase();
    if (/nome|name|atleta/.test(hl)) autoMap.name = i;
    else if (/ano|year|nasc|birth/.test(hl)) autoMap.year = i;
    else if (/sexo|sex|genero|género/.test(hl)) autoMap.sex = i;
    else if (/clube|club|equipe|team/.test(hl)) autoMap.club = i;
  });
  grid.innerHTML = fields.map(f => `
    <div>
      <label>${f.label}</label>
      <select id="map_${f.key}">
        <option value="">— selecionar coluna —</option>
        ${rawHeaders.map((h,i) => `<option value="${i}" ${autoMap[f.key]===i?'selected':''}>${h || '(col. '+(i+1)+')'}</option>`).join('')}
      </select>
    </div>`).join('');
  document.getElementById('colMapCard').style.display = 'block';
  document.getElementById('previewCard').style.display = 'none';
}

function runPreview() {
  const map = {};
  ['name','year','sex','club'].forEach(k => {
    const v = document.getElementById('map_'+k).value;
    if (v !== '') map[k] = parseInt(v);
  });
  if (Object.keys(map).length < 4) {
    alert('Mapeie todas as 4 colunas antes de pré-visualizar.'); return;
  }

  let log = '';
  const valid = [], warns = [], errors = [];

  parsedRows.forEach((row, i) => {
    const lineNum = i + 2;
    const name = String(row[map.name] || '').trim().toUpperCase();
    const yearRaw = String(row[map.year] || '').trim();
    const sex = String(row[map.sex] || '').trim().toUpperCase().charAt(0);
    const club = String(row[map.club] || '').trim().toUpperCase();
    const year = parseInt(yearRaw);

    const errs = [];
    if (!name) errs.push('Nome vazio');
    if (isNaN(year) || year < 1920 || year > ANO_REF - 10) errs.push(`Ano inválido (${yearRaw})`);
    if (!['M','F'].includes(sex)) errs.push(`Sexo inválido (${sex})`);
    if (!club) errs.push('Clube vazio');

    if (errs.length) {
      errors.push(lineNum);
      log += `<span class="log-err">ERRO   linha ${lineNum}: ${name||'(sem nome)'} → ${errs.join(', ')}</span>\n`;
    } else {
      const age = ANO_REF - year;
      if (age < 18) { warns.push(lineNum); log += `<span class="log-warn">AVISO  linha ${lineNum}: ${name} — idade ${age} anos (menor de 18)</span>\n`; }
      else { valid.push({name,year,sex,club,age}); log += `<span class="log-ok">OK     linha ${lineNum}: ${toTitleCase(name)} · ${year} · ${sex} · ${club}</span>\n`; }
    }
  });

  document.getElementById('importLog').innerHTML = log || '<span class="log-ok">Nenhum dado encontrado.</span>';
  document.getElementById('previewStats').innerHTML = `
    <span class="tag-ok">✅ ${valid.length} válidos</span>
    ${warns.length ? `<span class="tag-warn">⚠ ${warns.length} avisos</span>` : ''}
    ${errors.length ? `<span class="tag-err">✕ ${errors.length} erros</span>` : ''}`;
  document.getElementById('previewCard').style.display = 'block';

  // armazena para aplicar
  document.getElementById('btnApply')._valid = valid;
}

function applyImport() {
  const valid = document.getElementById('btnApply')._valid;
  if (!valid || !valid.length) { alert('Nenhum atleta válido para importar.'); return; }
  if (!confirm(`Substituir a lista atual por ${valid.length} atletas importados?`)) return;
  athletes = valid;
  saveAthletes(athletes);
  filterAthletes();
  resetImport();
  // Volta para aba atletas
  document.querySelectorAll('.nav-tab')[0].click();
  setTimeout(() => alert(`✅ ${valid.length} atletas importados com sucesso!`), 200);
}

function resetImport() {
  document.getElementById('fileInput').value = '';
  document.getElementById('fileAlert').innerHTML = '';
  document.getElementById('colMapCard').style.display = 'none';
  document.getElementById('previewCard').style.display = 'none';
  document.getElementById('progressWrap').style.display = 'none';
  parsedRows = []; rawHeaders = [];
}

function showAlert(id, msg, type) {
  const map = {success:'alert-success', error:'alert-error', info:'alert-info'};
  document.getElementById(id).innerHTML = `<div class="alert-box ${map[type]||'alert-info'}">${msg}</div>`;
}

function showProgress(show) {
  const w = document.getElementById('progressWrap');
  const b = document.getElementById('progressBar');
  if (show) { w.style.display='block'; b.style.width='0%'; setTimeout(()=>b.style.width='80%',50); }
  else { b.style.width='100%'; setTimeout(()=>{ w.style.display='none'; b.style.width='0%'; },400); }
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nome','Ano','Sexo','Clube'],
    ['EXEMPLO ATLETA SILVA','1990','M','ACQUAMASTER/FOZ'],
    ['EXEMPLO ATLETA SOUZA','1985','F','SANTA MONICA'],
  ]);
  ws['!cols'] = [{wch:40},{wch:8},{wch:8},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'Atletas');
  XLSX.writeFile(wb, 'modelo_atletas_acquamaster.xlsx');
}

// ==================== INIT ====================
filterAthletes();
renderAtletasSection();
buildProvaTabs();
