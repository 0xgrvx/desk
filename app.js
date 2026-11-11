// Grok Bot desk app. Token arrives once via #t= and lives in localStorage.
(function () {
  const h = new URLSearchParams(location.hash.slice(1)); const qd = new URLSearchParams(location.search).get('d'); if (qd && !h.get('d')) h.set('d', qd); if (h.get('t')) { localStorage.setItem('desk_t', h.get('t')); history.replaceState(null, '', location.pathname); }
  if (h.get('d')) { localStorage.setItem('desk_d', h.get('d')); if (!qd) history.replaceState(null, '', location.pathname + '?d=' + encodeURIComponent(h.get('d'))); }
  const T = localStorage.getItem('desk_t') || ''; const D = localStorage.getItem('desk_d') || ''; const PLANB = !T; window.PLANB = PLANB;
  let KEY = null, FOLDER = null, CACHE = {};
  async function sha(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
  async function bfile(name) {
    if (!KEY) { const f = await sha(D); FOLDER = [...f].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32); KEY = await crypto.subtle.importKey('raw', await sha('key:' + D), 'AES-GCM', false, ['decrypt']); }
    const r = await fetch(`d/${FOLDER}/${name}?_=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) { const e = new Error(r.status); e.status = r.status === 404 && name === 'state.json' ? 401 : r.status; throw e; }
    const j = await r.json(), b = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(j.n) }, KEY, b(j.c))));
  }
  async function apiB(p, opt) {
    if (opt && opt.method === 'POST') { const e = new Error(403); e.status = 403; e.body = { error: 'Read-only here. Use Telegram commands (pause, set, stack, paper/live).' }; throw e; }
    const st = await bfile('state.json'); const [path, qs] = p.split('?'); const q = new URLSearchParams(qs || '');
    if (path === 'state') return st;
    if (path === 'chart') return (await bfile('chart.json'))[q.get('range') || 'LIVE'];
    if (path === 'activity') return await bfile('activity.json');
    if (path.startsWith('coin/')) return await bfile(path + '.json');
    if (path.startsWith('audit/')) return st.audits[path.slice(6)] || { layers: [] };
    if (path === 'audits') return { rows: Object.values(st.audits).map(a => ({ mint: a.mint, name: a.name })) };
    if (path.startsWith('agents/')) { const n = path.split('/')[1]; return { rows: st.decisions[n] || [], running: st.agents[n].running }; }
    if (path === 'account') return st.account; if (path === 'settings') return st.settings;
    if (path === 'search') { const s = (q.get('q') || '').toLowerCase(); return { rows: (await bfile('activity.json')).rows.filter(r => (r.mint || '').toLowerCase() === s || (r.title || '').toLowerCase().includes(s)).map(r => ({ mint: r.mint })) }; }
    throw Object.assign(new Error(404), { status: 404 });
  } const V = document.getElementById('view'), ERR = document.getElementById('err');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = {}, failN = 0, lastOk = null, tab = 'home', range = 'LIVE', sub = null, retryT = null;
  const $ = (s, el = document) => el.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const usd = v => v == null ? 'n/a' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const big = v => v == null ? 'n/a' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : usd(v);
  const tm = ts => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  async function api(p, opt = {}) {
    if (PLANB) { try { const r = await apiB(p, opt); failN = 0; lastOk = Date.now(); ERR.classList.add('hidden'); return r; } catch (e) { if (e.status === 403) throw e; throw e; } }
    const r = await fetch('/api/' + p, { ...opt, headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' } });
    if (!r.ok) { const e = new Error(r.status); e.status = r.status; e.body = await r.json().catch(() => ({})); throw e; }
    failN = 0; lastOk = Date.now(); ERR.classList.add('hidden'); return r.json();
  }
  function offline() { failN++; let n = Math.min(30, 2 ** failN); ERR.classList.remove('hidden');
    const tick = () => { ERR.textContent = `Desk offline · retrying in ${n}s · last update ${lastOk ? new Date(lastOk).toLocaleTimeString() : 'never'}`; if (n-- <= 0) { clearInterval(retryT); render(); } };
    clearInterval(retryT); tick(); retryT = setInterval(tick, 1000); }
  window.__forceOffline = offline;
  function odo(el, text) { const prev = el.dataset.v || ''; el.dataset.v = text; if (RM || !prev) { el.textContent = text; return; }
    el.innerHTML = ''; const chars = text.split(''); chars.forEach((ch, i) => { const s = document.createElement('span'); s.className = 'dg';
      const pc = prev[prev.length - chars.length + i]; if (/\d/.test(ch) && pc !== ch && /\d/.test(pc || '')) { const iEl = document.createElement('i'); iEl.innerHTML = pc + '<br>' + ch; s.appendChild(iEl);
        iEl.style.transitionDelay = (chars.length - i) * 30 + 'ms'; requestAnimationFrame(() => requestAnimationFrame(() => iEl.style.transform = 'translateY(-50%)')); } else s.textContent = ch; el.appendChild(s); }); }
  const skel = hs => hs.map(x => `<div class="sk" style="height:${x}px;margin:12px 0"></div>`).join('');
  function nav(title) { return `<div class="nav"><button class="ib" data-go="account"><span class="av">G</span></button><div class="t">${title}</div>
    <button class="ib" id="srch" aria-label="Search">⌕</button><button class="ib" id="bell" aria-label="Pushes">🔔${last.state && last.state.unread ? '<span class="dot"></span>' : ''}</button></div>`; }
  function card(name, a, st) {
    const col = { scanner: '#64d2ff', analyst: '#ffd60a', executor: '#00d35a', risk: '#ff6b9a', auditor: '#fff' }[name];
    let body = '';
    if (name === 'scanner') body = `<div class="n">${a.pools} pools</div><div class="feed">${a.feed.length ? a.feed.map(f => f.verdict === 'kill' ? `<div><span class="strike">${esc(f.name || f.mint.slice(0, 6))}</span><span class="dn">${esc(f.reason)}</span></div>` : `<div><span>${esc(f.name || f.mint.slice(0, 6))}</span><span>→ auditor</span></div>`).join('') : '<div><span class="sub">Listening for graduations</span></div>'}</div>`;
    if (name === 'auditor') { const L = a.last || []; body = `<div class="n">${a.takenApart} taken apart</div><div class="strips">${[...Array(8)].map((_, i) => `<i class="${L[i] ? (L[i].pass ? 'g' : 'r') : ''}"></i>`).join('')}</div>
      <div class="sub">${L.length ? (L.length === 8 && L.every(l => l.pass) ? '8/8 → Executor' : esc((L.find(l => !l.pass) || {}).value_text || 'taking apart...')) : 'No coin taken apart yet'}</div><div class="sub">${a.rejected} rejected</div>`; }
    if (name === 'analyst') body = `<div class="sub">Scoring</div><canvas class="ring" data-score="${a.last ? a.last.score : ''}"></canvas><div class="sub">${a.last ? esc(a.last.reason || 'passed') : 'Nothing scored yet'}</div>`;
    if (name === 'executor') body = `<div class="n">${a.trades} trades</div><div>${a.last ? usd(a.last.size_usd) : '$0.00'} · ${a.stackPct}% of stack</div><div class="bar"><i style="width:${a.last ? 100 : 0}%"></i></div><div class="sub">${a.last ? '✓ Filled' : 'Waiting for a signal'}</div>`;
    if (name === 'risk') body = `<div class="n">${a.open ? 'Guarding' : (a.lastExit || 'Idle')}</div><div><span class="pill mono" style="background:var(--red)">stop -${a.stopPct}%</span> <span class="pill mono" style="background:var(--green);color:#000">trail ${a.trailPct}%</span></div><div class="sub">${a.open} open</div>`;
    return `<div class="card"><div class="h"><span style="color:${col}">${name[0].toUpperCase() + name.slice(1)}</span><span class="sub">${a.running ? '● running' : '○ paused'}</span></div>${body}</div>`;
  }
  function actRow(r) { const ico = { bought: '↗', sold: '✓', stopped: '↓', rejected: '✕' }[r.kind] || '•';
    return `<div class="row" data-open="${r.kind === 'rejected' ? 'audit' : 'coin'}" data-mint="${esc(r.mint)}"><div class="ico">${ico}</div><div class="m"><div>${esc(r.title)}</div><div class="sub">${esc(r.subtitle)}</div></div>
      <div class="v ${/^\+/.test(r.value) ? 'up' : /^-/.test(r.value) ? 'dn' : 'sub'}">${esc(r.value)}</div></div>`; }
  async function home() {
    if (!last.state) V.innerHTML = nav('Grok Bot ›') + skel([80, 220, 40, 300, 240]);
    const [st, ch, ac] = await Promise.all([api('state'), api('chart?range=' + range), api('activity')]); last.state = st;
    window.MINSCORE = 70;
    V.innerHTML = nav('Grok Bot ›') + `<div class="big"><span id="bal"></span>${st.mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : ''}</div>
      <div class="sub"><span class="${st.todayPct >= 0 ? 'up' : 'dn'}">${st.todayPct >= 0 ? '+' : ''}${st.todayPct.toFixed(2)}%</span> today <span class="pill mult">${st.multiplier.toFixed(2)}×</span></div>
      <canvas class="chart" id="ch"></canvas><div class="ranges">${['LIVE', '1H', '4H', '1D', '1W', 'ALL'].map(r => `<button class="${r === range ? 'on' : ''}" data-range="${r}">${r}</button>`).join('')}</div>
      <h2>Agents · ${Object.values(st.agents).filter(a => a.running).length} running</h2><div class="car">${['scanner', 'auditor', 'analyst', 'executor', 'risk'].map(n => card(n, st.agents[n], st)).join('')}</div>
      <h2>Activity <a href="#" data-go="activity">See all</a></h2>${ac.rows.length ? ac.rows.slice(0, 5).map(actRow).join('') : '<div class="empty">Nothing yet tonight</div>'}`;
    odo($('#bal'), usd(st.balance)); Charts.line($('#ch'), ch.points, ch.start, ch.marks); document.querySelectorAll('canvas.ring').forEach(c => Charts.ring(c, c.dataset.score === '' ? null : +c.dataset.score));
  }
  async function agents() {
    if (!last.state) V.innerHTML = nav('Agents') + skel([200, 200, 200]);
    const st = await api('state'); last.state = st; const names = ['scanner', 'auditor', 'analyst', 'executor', 'risk'];
    const ds = await Promise.all(names.map(n => api(`agents/${n}/decisions`)));
    V.innerHTML = nav('Agents') + names.map((n, i) => { const a = st.agents[n], lock = n === 'risk' && a.open > 0;
      return `<div class="set" style="padding:16px"><div class="nf"><b>${n[0].toUpperCase() + n.slice(1)}</b><span class="sub">${a.running ? '● running' : '○ paused'} · ${a.today} today</span>
        <button class="sw ${a.running ? 'on' : ''}" ${lock ? 'disabled title="Risk is locked while a position is open"' : ''} data-toggle="${n}" data-running="${a.running}" aria-label="pause or resume"></button></div>
        ${ds[i].rows.length ? ds[i].rows.map(d => `<div class="lr"><span>${tm(d.ts)} · <a href="${esc(d.coin_url)}" style="color:var(--blue)">${esc(d.name || (d.mint || '').slice(0, 6))}</a></span><span class="${d.verdict === 'pass' || d.verdict === 'sent' ? 'up' : 'dn'}">${esc(d.verdict)} ${esc(d.reason || '')}</span></div>`).join('') : '<div class="empty">No decisions yet</div>'}
        <button class="btn sec" data-go="account" style="min-height:44px">Settings</button></div>`; }).join('');
  }
  async function activity() {
    V.innerHTML = nav('Activity') + skel([60, 60, 60, 60]); const ac = await api('activity');
    V.innerHTML = nav('Activity') + (ac.rows.length ? ac.rows.map(actRow).join('') : '<div class="empty">Nothing yet tonight</div>');
  }
  async function auditScreen(mint) {
    V.innerHTML = nav('Auditor') + skel([300, 300]);
    const a = mint ? await api('audit/' + mint) : null;
    if (!a || !a.layers.length) { const list = await api('audits'); V.innerHTML = nav('Auditor') + '<div class="empty">No coin taken apart yet</div>' + list.rows.map(r => `<div class="row" data-open="audit" data-mint="${r.mint}"><div class="m"><div>${esc(r.name || r.mint)}</div></div></div>`).join(''); return; }
    const red = a.layers.find(l => !l.pass), names = ['Mint authority', 'Freeze authority', 'Dev wallet', 'Top 10 holders', 'Liquidity', 'Pool age', 'Bundled wallets', 'Delegations'];
    V.innerHTML = nav('Auditor') + `<h2>${esc(a.name || mint.slice(0, 6))}</h2><div style="padding:16px 0 24px">${names.map((_, i) => `<div class="disc" id="d${i}" style="z-index:${8 - i}"></div>`).join('')}</div>
      <div>${names.map((n, i) => { const l = a.layers[i]; return `<div class="lr"><span>${i + 1} ${n}</span><span class="${l ? (l.pass ? 'up' : 'dn') : 'x'}">${l ? esc(l.value_text) + (l.pass ? ' ✓' : ' ✕') : 'not checked'}</span></div>`; }).join('')}</div>
      ${red ? `<h2 class="dn">Rejected · ${esc(red.value_text)}</h2><div class="sub">Grok Bot won't buy ${esc(a.name || '')}</div>` : `<h2 class="up">Cleared · 8/8 parts</h2><div class="sub">Sent to Executor · ${usd(a.sentSize)}</div>`}
      <div class="nf" style="display:flex;justify-content:space-between;margin-top:16px"><span>Take apart before buying</span><button class="sw ${a.enabled ? 'on' : ''}" id="audtog"></button></div>
      <a class="btn" href="${esc(a.coin_url)}">Open on FOMO</a>`;
    const ds = names.map((_, i) => $('#d' + i)); let i = 0;
    const step = () => { if (i > 0) ds[i - 1].classList.remove('beam'); if (i >= a.layers.length) return; ds[i].classList.add('beam');
      setTimeout(() => { ds[i].classList.add(a.layers[i].pass ? 'g' : 'r'); i++; setTimeout(step, 150); }, RM ? 0 : 350); };
    RM ? a.layers.forEach((l, k) => ds[k].classList.add(l.pass ? 'g' : 'r')) : step();
    $('#audtog').onclick = async () => { if (a.enabled && !(confirm('Turn off auditing?') && confirm('Really buy coins without the 8 checks?'))) return;
      await api('settings', { method: 'POST', body: JSON.stringify({ 'auditor.enabled': !a.enabled }) }); auditScreen(mint); };
  }
  async function coinScreen(mint) {
    V.innerHTML = nav('Coin') + skel([60, 80, 240, 120]); const c = await api('coin/' + mint); const p = c.position, open = p && !p.closed_at;
    const age = c.coin.migrated_at ? Math.round((Date.now() / 1000 - c.coin.migrated_at) / 3600) + 'h old' : '';
    const since = p && c.price ? (c.price / p.entry_price - 1) * 100 : null;
    V.innerHTML = nav('Coin') + `<div class="nf" style="display:flex;gap:8px;align-items:center"><h2 style="margin:8px 0">${esc(c.coin.name || mint.slice(0, 6))}</h2>${c.mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : ''}${c.shield ? `<span class="chip">🛡 ${c.shield}</span>` : ''}</div>
      <div class="sub">${esc(c.coin.symbol || '')} · Solana · ${age}</div><div class="big" style="font-size:44px">${c.price == null ? 'n/a' : '$' + Number(c.price).toPrecision(4)}</div>
      ${since != null ? `<div class="${since >= 0 ? 'up' : 'dn'}">${since >= 0 ? '▲' : '▼'} ${Math.abs(since).toFixed(1)}% since entry</div>` : ''}
      <canvas class="chart" id="cc" style="height:260px;margin-top:12px"></canvas>
      <div class="lr"><span>Market cap</span><span>${big(c.stats.marketCap)}</span></div><div class="lr"><span>Liquidity</span><span>${big(c.stats.liquidity)}</span></div>
      <div class="lr"><span>24h volume</span><span>${big(c.stats.volume24h)}</span></div><div class="lr"><span>Holders</span><span>${c.stats.holders ?? 'n/a'}</span></div>
      ${open && c.exit ? `<h2>Your position · ${usd(p.size_usd)} in · Executor</h2><div class="set" style="padding:12px 16px"><div class="lr"><span>Stop line</span><span class="dn">$${c.exit.stopLine.toPrecision(4)} (-${c.exit.stopPct}%)</span></div>
        <div class="lr"><span>Trail line</span><span>${c.exit.trailLine ? '$' + c.exit.trailLine.toPrecision(4) : 'not active'}</span></div><div class="lr"><span>Timeout in</span><span>${Math.max(0, Math.round((c.exit.timeoutAt - Date.now() / 1000) / 60))} min</span></div></div>` : ''}
      <a class="btn" href="${esc(c.coin_url)}">${open ? 'Sell on FOMO' : 'Buy on FOMO'}</a>`;
    Charts.candles($('#cc'), c.candles, open && c.exit ? c.exit.exitLine : null);
  }
  async function account() {
    V.innerHTML = nav('Account') + skel([60, 60, 300]); const [a, s] = await Promise.all([api('account'), api('settings')]);
    const groups = {}; Object.keys(s.values).forEach(k => { const g = k.split('.')[0]; (groups[g] = groups[g] || []).push(k); });
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    V.innerHTML = nav('Account') + `<div class="set" style="padding:12px 16px"><div class="seg"><button class="${a.mode === 'PAPER' ? 'on' : ''}" data-mode="PAPER">PAPER</button><button class="${a.mode === 'LIVE' ? 'on' : ''}" data-mode="LIVE">LIVE</button></div>
      <label>LIVE stack<div class="nf"><span class="sub">PAPER balance ${usd(a.paperStack)}</span><input type="number" step="0.01" id="stack" value="${a.stack}"></div></label></div>
      <div class="set"><a class="row" href="${esc(a.profile_url)}" style="color:inherit;text-decoration:none"><div class="m"><div>Your FOMO profile</div><div class="sub">@${esc(a.fomo_handle)}</div></div><span>›</span></a>
      <div class="row" id="invite"><div class="m"><div>Invite a friend</div></div><span>›</span></div>
      <div class="row"><div class="m"><div>Telegram</div><div class="sub">${a.telegram ? 'connected' : 'not connected'}</div></div><button class="btn sec" style="width:auto;padding:0 14px;margin:0;min-height:44px" id="tpush">Send test push</button></div>
      ${standalone ? '<div class="row" id="wpush"><div class="m"><div>Enable notifications</div></div><span>›</span></div>' : ''}</div>
      ${Object.entries(groups).map(([g, ks]) => `<h2>${g[0].toUpperCase() + g.slice(1)}</h2><div class="set">${ks.map(k => { const v = s.values[k], r = s.ranges[k];
        if (typeof v === 'boolean') return `<label><div class="nf"><span>${k.split('.')[1]}</span><button class="sw ${v ? 'on' : ''}" data-bool="${k}"></button></div></label>`;
        if (typeof r[0] === 'string') return `<label><div class="nf"><span>${k.split('.')[1]}</span><select data-k="${k}">${r.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></div></label>`;
        if (typeof v === 'number' && r[0] != null) return `<label><div class="nf"><span>${k.split('.')[1]}</span><input class="mono" type="number" step="any" data-k="${k}" value="${v}"></div><input type="range" min="${r[0]}" max="${r[1]}" step="${(r[1] - r[0]) / 200}" value="${v}" data-r="${k}"></label>`;
        return `<label><div class="nf"><span>${k.split('.')[1]}</span><input type="text" data-k="${k}" value="${esc(v)}"></div></label>`; }).join('')}</div>`).join('')}<div id="msg" class="sub" style="padding:8px 0 24px"></div>`;
    if (PLANB) { V.querySelectorAll('input,select,.sw,[data-mode],#tpush').forEach(el => { el.disabled = true; el.style.opacity = .5; });
      const n = document.createElement('div'); n.className = 'sub'; n.style.padding = '8px 0'; n.textContent = 'Settings are read-only in this app. Change them in Telegram, e.g. "set stop to -8%". Notifications: Telegram only (no web push on this hosting).'; V.prepend(n); }
    const save = async (k, v) => { try { const r = await api('settings', { method: 'POST', body: JSON.stringify({ [k]: v }) }); $('#msg').textContent = (r.result[k] === 'ok' ? `${k} saved` : r.result[k]) + (r.ticket ? ' · ' + r.ticket : ''); } catch (e) { $('#msg').textContent = 'Save failed'; } };
    V.querySelectorAll('[data-k]').forEach(el => el.onchange = () => save(el.dataset.k, el.value));
    V.querySelectorAll('[data-r]').forEach(el => el.oninput = () => { const n = V.querySelector(`[data-k="${el.dataset.r}"]`); n.value = (+el.value).toFixed(2); });
    V.querySelectorAll('[data-r]').forEach(el => el.onchange = () => save(el.dataset.r, el.value));
    V.querySelectorAll('[data-bool]').forEach(el => el.onclick = () => save(el.dataset.bool, !el.classList.contains('on')).then(account));
    $('#stack').onchange = e => save('desk.stack', e.target.value);
    V.querySelectorAll('[data-mode]').forEach(b => b.onclick = async () => { const m = b.dataset.mode; let body = { mode: m };
      if (m === 'LIVE') { const t = prompt('Type LIVE to confirm'); if (t !== 'LIVE') return; body.confirm = 'LIVE'; }
      try { await api('mode', { method: 'POST', body: JSON.stringify(body) }); account(); } catch (e) { $('#msg').textContent = (e.body && e.body.error) || 'Mode change failed'; } });
    $('#invite').onclick = async () => { try { if (navigator.share) await navigator.share({ url: a.SIGNUP_URL }); else throw 0; } catch (e) { await navigator.clipboard.writeText(a.SIGNUP_URL); $('#msg').textContent = 'Link copied'; } };
    $('#tpush').onclick = async () => { const r = await api('test_push', { method: 'POST' }); $('#msg').textContent = r.ok ? 'Test push sent' : 'Test push failed'; };
    if ($('#wpush')) $('#wpush').onclick = async () => { const reg = await navigator.serviceWorker.register('sw.js'); const perm = await Notification.requestPermission(); if (perm !== 'granted') return;
      const k = a.vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/'); const raw = Uint8Array.from(atob(k + '='.repeat((4 - k.length % 4) % 4)), c => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw }); await api('push', { method: 'POST', body: JSON.stringify(sub.toJSON()) }); $('#msg').textContent = 'Notifications on'; };
  }
  async function render() {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    try { if (sub) await (sub.type === 'coin' ? coinScreen(sub.mint) : auditScreen(sub.mint)); else await ({ home, agents, activity, account }[tab])(); }
    catch (e) { if (e.status === 401) { V.innerHTML = '<div class="empty">Open the app once with your private link to sign in.</div>'; return; } offline(); }
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-tab],[data-go],[data-range],[data-open],[data-toggle],#bell,#srch'); if (!t) return;
    if (t.dataset.tab || t.dataset.go) { e.preventDefault(); tab = t.dataset.tab || t.dataset.go; sub = null; render(); }
    else if (t.dataset.range) { range = t.dataset.range; render(); }
    else if (t.dataset.open) { sub = { type: t.dataset.open, mint: t.dataset.mint }; render(); }
    else if (t.dataset.toggle) { await api(`agents/${t.dataset.toggle}/${t.dataset.running === 'true' ? 'pause' : 'resume'}`, { method: 'POST' }).catch(x => alert((x.body && x.body.error) || 'failed')); render(); }
    else if (t.id === 'bell') { await api('read', { method: 'POST' }); tab = 'activity'; sub = null; render(); }
    else if (t.id === 'srch') { const q = prompt('Name, symbol or mint'); if (!q) return; const r = await api('search?q=' + encodeURIComponent(q)); if (r.rows[0]) { sub = { type: 'coin', mint: r.rows[0].mint }; render(); } else alert('Not on the desk'); }
  });
  if (T && !PLANB) { try { const es = new EventSource('/api/stream?t=' + encodeURIComponent(T)); let pend = null;
    es.onmessage = es.onerror = null; ['scan', 'audit_layer', 'verdict', 'signal', 'fill', 'exit', 'balance'].forEach(k => es.addEventListener(k, () => { if (sub || tab === 'account') return; clearTimeout(pend); pend = setTimeout(render, 400); })); } catch (e) { } }
  setInterval(() => { if (!sub && tab === 'home') render(); }, 15000);
  render();
})();
