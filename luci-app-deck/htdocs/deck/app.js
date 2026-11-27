/* SPDX-License-Identifier: Apache-2.0
 * Deck: a standalone dashboard for OpenWrt routers.
 * Talks to the router through ubus over HTTP (/ubus) with the root login.
 * Every screen reads the router's capabilities first and leaves out what
 * the router does not have. No framework, no build step. */
(function () {
'use strict';

const VERSION = '0.2.0';
const NULL_SID = '00000000000000000000000000000000';
const root = document.getElementById('root');

/* ---------------- helpers ---------------- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const fmtBytes = (n) => { if (n == null) return '—'; const u = [ 'B', 'KB', 'MB', 'GB', 'TB' ]; let i = 0; while (n >= 1024 && i < 4) { n /= 1024; i++; } return (i ? n.toFixed(n < 10 ? 2 : 1) : n) + ' ' + u[i]; };
const fmtRate = (bps) => { if (bps == null) return [ '—', '' ]; const m = bps * 8 / 1e6; return m >= 1 ? [ m.toFixed(1), 'Mbit/s' ] : [ (bps * 8 / 1e3).toFixed(0), 'kbit/s' ]; };
const fmtDur = (s) => { s = Math.max(0, Math.floor(s || 0)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d} d ${h} h` : h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`; };
const sigBars = (dbm) => dbm == null ? 0 : dbm >= -55 ? 4 : dbm >= -65 ? 3 : dbm >= -75 ? 2 : dbm >= -85 ? 1 : 0;
const bars = (n, color) => `<span class="dk-bars" aria-hidden="true">${[ 1, 2, 3, 4 ].map((i) => `<span style="height:${i * 4 + 2}px;background:${i <= n ? (color || 'var(--dk-ink)') : 'var(--dk-off)'}"></span>`).join('')}</span>`;
const tag = (t, k) => `<span class="dk-tag dk-tag-${k || 'off'}">${esc(t)}</span>`;
const lanIp = (st) => String(Array.isArray(st.lan) ? st.lan[0] : (st.lan || '')).replace(/\/.*$/, '');
const BAND = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz', '60g': '60 GHz' };
const ENC = { none: 'Open', psk: 'WPA', psk2: 'WPA2', 'psk-mixed': 'WPA/WPA2', sae: 'WPA3', 'sae-mixed': 'WPA2/WPA3', owe: 'OWE', 'psk2+ccmp': 'WPA2' };
const ICON = {
	home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
	vpn: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
	net: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01',
	dev: 'M4 5h16v10H4zM8 19h8M12 15v4',
	sys: 'M4 6h16M4 12h16M4 18h16',
	adv: 'M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5',
	out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
	sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
	moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
	eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
	laptop: 'M4 6h16v10H4zM2 19h20', phone: 'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
	unknown: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M3 4h18v16H3z',
	yes: 'M5 12l5 5L20 7', no: 'M6 6l12 12M18 6 6 18', power: 'M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0'
};
const svg = (name, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ''}><path d="${ICON[name]}"></path></svg>`;

function spark(values, color) {
	const v = values.length > 1 ? values : [ 0, 0 ];
	const max = Math.max.apply(null, v.concat([ 1e-9 ])) * 1.15;
	const pts = v.map((x, i) => `${(i * 200 / (v.length - 1)).toFixed(1)},${(40 - x / max * 40).toFixed(1)}`).join(' ');
	return `<svg class="dk-spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></polyline></svg>`;
}

/* ---------------- theme ---------------- */
function applyTheme() {
	let pref = null;
	try { pref = localStorage.getItem('deck.theme'); } catch (e) {}
	const dark = pref ? pref === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
	root.classList.toggle('dk-light', !dark);
	document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0D0E0B' : '#E4E2DA');
	return dark;
}
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------------- API ---------------- */
let SID = null;
try { SID = sessionStorage.getItem('deck.sid') || localStorage.getItem('deck.sid'); } catch (e) {}
let rid = 0;

class ApiError extends Error { constructor(code, msg) { super(msg || String(code)); this.code = code; } }

async function call(object, method, params, sid) {
	const res = await fetch('/ubus', {
		method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
		body: JSON.stringify({ jsonrpc: '2.0', id: ++rid, method: 'call', params: [ sid || SID || NULL_SID, object, method, params || {} ] })
	});
	const j = await res.json();
	/* -32002 = access denied (session gone); -32000 object not found happens
	 * for a moment while rpcd reloads, so it is retried, not a logout */
	if (j.error) throw new ApiError(j.error.code == -32002 ? 'session' : j.error.code, j.error.message);
	const r = j.result || [];
	if (r[0] === 6) throw new ApiError('session', 'Permission denied');
	if (r[0] !== 0) throw new ApiError(r[0], 'ubus error ' + r[0]);
	return r[1] || {};
}

async function login(password, remember) {
	const r = await call('session', 'login', { username: 'root', password, timeout: remember ? 86400 * 7 : 3600 }, NULL_SID);
	SID = r.ubus_rpc_session;
	try { (remember ? localStorage : sessionStorage).setItem('deck.sid', SID); } catch (e) {}
	/* log into LuCI as well, so "Advanced" links open without a second login */
	fetch('/cgi-bin/luci/', { method: 'POST', credentials: 'same-origin', redirect: 'manual',
		body: new URLSearchParams({ luci_username: 'root', luci_password: password }) }).catch(() => {});
}

function forget() {
	SID = null;
	try { sessionStorage.removeItem('deck.sid'); localStorage.removeItem('deck.sid'); } catch (e) {}
}

async function logout() {
	try { await call('session', 'destroy', {}); } catch (e) {}
	fetch('/cgi-bin/luci/admin/logout', { credentials: 'same-origin', redirect: 'manual' }).catch(() => {});
	forget();
	state.notice = 'You are logged out.';
	render();
}

const uciGet = (config, section) => call('uci', 'get', section ? { config, section } : { config }).then((r) => r.values || r.value || {});
const uciSet = (config, section, values) => call('uci', 'set', { config, section, values });
const uciCommit = (config) => call('uci', 'commit', { config });

/* ---------------- state ---------------- */
const state = { caps: null, st: null, devs: [], evs: [], nodes: null, rules: null, wifiCfg: null, scan: null, busyUntil: 0, sel: null, filter: 'online', notice: null, edits: {}, lastSample: null, hist: { down: [], up: [] } };

function sample(st) {
	let rx = 0, tx = 0;
	for (const u of st.uplinks || []) if (u.up) { rx += u.rx_bytes; tx += u.tx_bytes; }
	const now = { t: st.time, rx, tx }, last = state.lastSample;
	let rate = null;
	if (last && now.t > last.t && rx >= last.rx && tx >= last.tx) rate = { down: (rx - last.rx) / (now.t - last.t), up: (tx - last.tx) / (now.t - last.t) };
	state.lastSample = now;
	if (rate) { state.hist.down.push(rate.down); state.hist.up.push(rate.up); if (state.hist.down.length > 60) { state.hist.down.shift(); state.hist.up.shift(); } state.rate = rate; }
	return state.rate || null;
}

async function load(page) {
	const jobs = [ call('deck', 'status').then((s) => { state.st = s; sample(s); }) ];
	if (!state.caps) jobs.push(call('deck', 'capabilities').then((c) => { state.caps = c; }));
	if (page == 'home' || page == 'devices') jobs.push(call('deck', 'devices').then((d) => { state.devs = d.devices || []; }));
	if (page == 'home' || page == 'system') jobs.push(call('deck', 'events', { limit: 12 }).then((e) => { state.evs = e.events || []; }));
	if (page == 'vpn' || page == 'home') {
		jobs.push(call('deck', 'vpn_rules').then((r) => { state.rules = r; }).catch(() => { state.rules = null; }));
		if (page == 'vpn') jobs.push(call('deck', 'vpn_nodes').then((n) => { state.nodes = n; }));
	}
	if ((page == 'network' && !state.wifiCfg) || page == 'system-cfg') jobs.push(uciGet('wireless').then((w) => { state.wifiCfg = w; }));
	if (page == 'system' && !state.deckCfg) jobs.push(uciGet('deck').then((d) => { state.deckCfg = d; }));
	await Promise.all(jobs);
}

/* ---------------- toasts & modals ---------------- */
function toast(text, kind) {
	let box = $('.toasts');
	if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
	const t = document.createElement('div');
	t.className = 'toast ' + (kind || '');
	t.textContent = text;
	box.appendChild(t);
	setTimeout(() => t.remove(), 5000);
}

function modal(title, body, actions, danger) {
	return new Promise((resolve) => {
		const s = document.createElement('div');
		s.className = 'scrim dk' + (root.classList.contains('dk-light') ? ' dk-light' : '');
		s.innerHTML = `<div class="modal${danger ? ' danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">${esc(title)}</h2>${body}<div class="acts">${actions.map((a, i) => `<button class="dk-btn ${a.kind ? 'dk-btn-' + a.kind : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
		const done = (v) => { s.remove(); resolve(v); };
		s.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-i]'); if (b) done(actions[+b.dataset.i].value); else if (ev.target === s) done(null); });
		s.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') done(null); });
		document.body.appendChild(s);
		const first = s.querySelector('input, button[data-i]');
		if (first) first.focus();
	});
}
const confirmBox = (title, text, ok, kind) => modal(title, `<p>${esc(text)}</p>`, [ { label: 'Cancel', value: false }, { label: ok, value: true, kind: kind || 'amber' } ], kind == 'red');

/* ---------------- shell ---------------- */
const PAGES = [ [ 'home', 'Home', 'home' ], [ 'vpn', 'VPN', 'vpn' ], [ 'network', 'Network', 'net' ], [ 'devices', 'Devices', 'dev' ], [ 'system', 'System', 'sys' ] ];
const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/')[0];

function shell(page, inner) {
	const st = state.st, caps = state.caps;
	const pages = PAGES.filter((p) => p[0] != 'vpn' || caps.vpn);
	const nav = pages.map((p) => `<li><a href="#/${p[0]}" ${p[0] == page ? 'aria-current="page"' : ''}>${svg(p[2])}${p[1]}</a></li>`).join('')
		+ `<li><a href="/cgi-bin/luci/" target="_blank" rel="noopener">${svg('adv')}LuCI</a></li>`;
	const tabs = pages.slice(0, 5).map((p) => `<a href="#/${p[0]}" ${p[0] == page ? 'aria-current="page"' : ''}>${svg(p[2])}${p[1]}</a>`).join('');
	const dark = !root.classList.contains('dk-light');
	return `<div class="app">
		<aside class="rail" aria-label="Router and pages">
			<div><div class="brand-name">${esc(st.board.hostname)}</div><div class="brand-sub">${esc(st.board.model)}<br>${esc(st.board.release.description.replace(/ r\d+.*$/, ''))}<br>${esc(lanIp(st))}</div></div>
			<nav aria-label="Pages"><ul class="nav">${nav}</ul></nav>
			${hwBox()}
			<div class="rail-foot"><div class="iconrow">
				<button data-act="theme" aria-label="${dark ? 'Switch to light theme' : 'Switch to dark theme'}">${svg(dark ? 'sun' : 'moon')}</button>
				<button data-act="logout" aria-label="Log out">${svg('out')}</button>
			</div></div>
		</aside>
		<main class="page" id="page">${inner}</main>
		<nav class="tabs" aria-label="Pages">${tabs}</nav>
	</div>`;
}

function ledState() {
	const st = state.st, vs = st.vpn ? st.vpn.state : 'none', off = st.net && st.net.online === false;
	if (off) return [ 'red', 'red' ];
	if (vs == 'failed') return [ 'red', 'red, blinking' ];
	if (vs == 'switching') return [ 'white', 'white, blinking' ];
	if (vs == 'off') return [ '', 'short blip' ];
	return [ 'white', 'solid' ];
}

function hwBox() {
	const st = state.st, rows = [];
	const cfg = state.st.vpn_button || {};
	const leds = (st.leds || []).filter((l) => l.brightness > 0 || l.trigger != 'none');
	if ((st.leds || []).length) {
		const lit = leds[0];
		const cls = lit ? (lit.color == 'red' ? 'red' : lit.color == 'green' ? 'green' : 'white') : '';
		rows.push(`<div class="hwrow"><span class="led ${cls} ${lit && lit.trigger == 'timer' ? 'blink' : ''}" aria-hidden="true"></span>LED · ${esc(lit ? lit.name.replace(/:.*$/, '') + (lit.trigger == 'timer' ? ', blinking' : '') : 'off')}</div>`);
	}
	const btn = (st.buttons || []).find((b) => b.switch && (b.name == cfg.name || !cfg.name));
	if (btn && btn.state) {
		const on = cfg.name ? btn.state == cfg.on_event : btn.state == 'pressed';
		rows.push(`<div class="hwrow"><span class="slider ${on ? 'on' : ''}" aria-hidden="true"><i></i></span>${esc(btn.label)} · ${esc(btn.state)}</div>`);
	}
	if (!rows.length) return '';
	return `<div class="hwbox"><div class="dk-label">On the router now</div>${rows.join('')}</div>`;
}

function head(kicker, title, cls) {
	return `<div class="dk-head"><div><div class="dk-kicker">${esc(kicker)}</div><h1 class="dk-title"><span class="${cls || ''}">${esc(title)}</span></h1></div><span class="dk-mono dk-dim" style="font-size:13px">updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>`;
}
const card = (title, body, link, cls) => `<section class="dk-card ${cls || ''}"><div class="dk-card-head"><h2 class="dk-h2">${esc(title)}</h2>${link ? `<a class="dk-more" href="${link[1]}" ${link[1].indexOf('/cgi-bin') == 0 ? 'target="_blank" rel="noopener"' : ''}>${esc(link[0])}</a>` : ''}</div>${body}</section>`;
const empty = (t, s, action) => `<div class="dk-empty"><b>${esc(t)}</b><span class="dk-dim">${esc(s)}</span>${action || ''}</div>`;
const activeUplink = (st) => (st.uplinks || []).find((u) => u.up) || null;

/* ---------------- shared widgets ---------------- */
function vpnSwitch(vpn, big) {
	const busy = vpn.state == 'switching' || Date.now() < state.busyUntil;
	const color = { on: 'var(--dk-green)', switching: 'var(--dk-amber)', failed: 'var(--dk-red)' }[vpn.state] || 'var(--dk-green)';
	const label = vpn.state == 'switching' ? 'WAIT' : vpn.state == 'failed' ? 'FAILED' : 'VPN';
	return `<button class="dk-switch" role="switch" aria-checked="${vpn.enabled}" aria-label="VPN" data-act="vpn-toggle" style="--c:${color}" ${busy ? 'disabled' : ''}>
		<span class="knob"></span><span class="lbl off">OFF</span><span class="lbl on"><span class="${busy ? 'blink' : ''}">${label}</span></span></button>`;
}
function vpnMsg(vpn) {
	return { on: `On, through ${vpn.node ? vpn.node.name : '?'}.`, switching: 'Starting or stopping. Usually under a minute on small routers.', failed: 'The switch is on but the VPN core is not running.', off: 'Off. Every device goes straight to your provider.' }[vpn.state] || '';
}
function switchNote() {
	const st = state.st, cfg = st.vpn_button || {};
	const b = cfg.name ? (st.buttons || []).find((x) => x.name == cfg.name) : null;
	if (b && b.state) return `<p class="dk-note">The ${esc(b.label)} switch on the router is on the ${b.state == cfg.on_event ? 'VPN' : 'OFF'} side. Whichever you change last wins.</p>`;
	return '';
}

/* ---------------- screens ---------------- */
function pageHome() {
	const st = state.st, vpn = st.vpn, up = activeUplink(st), online = st.net ? st.net.online : null;
	const rate = state.rate;
	let title = 'Online. Devices go direct.', tcls = '';
	if (online === false || !up) { title = 'No internet right now.'; tcls = 'bad'; }
	else if (vpn) title = { on: 'Protected.', switching: 'VPN is switching…', failed: 'VPN failed. Tunnel is down.', off: 'VPN off. Going direct.' }[vpn.state], tcls = vpn.state == 'failed' ? 'bad' : vpn.state == 'switching' ? 'warn' : '';
	let out = head('Right now', title, tcls);

	if (vpn && vpn.state == 'failed') out += `<div class="dk-banner bad" role="status"><span>The VPN core is not running, so sites that need the VPN will not load.</span><button class="dk-btn" data-act="vpn-restart">Restart VPN</button></div>`;
	else if (!up || online === false) out += `<div class="dk-banner bad" role="status"><span>No internet on any uplink. The router keeps checking every few seconds.</span></div>`;
	else if (up.wireless && (st.uplinks || []).some((u) => !u.wireless && !u.up)) out += `<div class="dk-banner" role="status"><span>Cable unplugged. Running on the Wi-Fi uplink ${esc(up.ssid || up.name)}.</span></div>`;

	/* traffic path */
	const online_devs = (state.devs || []).filter((d) => d.online);
	const hop = (cls, k, t, s, tcl) => `<li class="dk-hop ${cls}"><span class="k">${esc(k)}</span><span class="t ${tcl || ''}">${esc(t)}</span><span class="s">${esc(s || '')}</span></li>`;
	const wire = (cls, label, c) => `<li class="dk-wire ${cls}" aria-hidden="true" style="--c:${c || 'var(--dk-green)'}"><span>${esc(label || '')}</span><i></i></li>`;
	let path = hop('', 'Devices', String(online_devs.length), 'online now') + wire('ok flow') + hop('ok', 'Router', st.board.hostname, lanIp(st));
	if (vpn) {
		const vs = vpn.state;
		path += wire(vs == 'on' ? 'ok flow' : vs == 'switching' ? 'flow' : vs == 'failed' ? 'bad' : '', '', vs == 'switching' ? 'var(--dk-amber)' : null);
		path += vs == 'on' ? hop('ok', 'VPN tunnel', vpn.node ? vpn.node.name : '?', (vpn.node && vpn.node.protocol || '').toUpperCase())
			: vs == 'switching' ? hop('warn', 'VPN tunnel', 'Switching', vpn.core || '', 'blink')
			: vs == 'failed' ? hop('bad', 'VPN tunnel', 'Down', 'core not running')
			: hop('ghost', 'VPN tunnel', 'Bypassed', 'switch is off');
		path += wire(!up ? 'bad' : vs == 'on' ? 'ok flow' : '', vs == 'on' ? 'encrypted' : 'direct');
	} else path += wire(up ? 'ok flow' : 'bad');
	path += up ? hop(up.wireless ? 'blue' : 'ok', `Internet · ${up.name}`, up.wireless ? (up.ssid || 'Wi-Fi') : 'Cable', up.ipv4 || '') : hop('bad', 'Internet', 'No link', 'all uplinks down');
	let bypass = '';
	if (vpn && vpn.state == 'on' && state.rules && state.rules.shunt) {
		const direct = state.rules.rules.filter((r) => r.target == 'Direct' && r.used && r.id != '_default');
		if (direct.length) bypass = `<div class="dk-bypass"><span class="dk-label">Skips the tunnel</span>${direct.map((r) => `<span class="dk-chip">${esc(r.name)}</span>`).join('')}<span class="dk-chip">Local network</span><a class="dk-more" style="margin-left:auto" href="#/vpn">Routing rules</a></div>`;
	}
	out += card('Traffic path', `<ol class="dk-path" aria-label="How traffic leaves your network">${path}</ol>${bypass}`, [ 'Network details', '#/network' ]);

	/* row: switch, readouts, sources */
	let row = '';
	if (vpn) row += card('VPN switch', vpnSwitch(vpn) + `<p class="dk-sub">${esc(vpnMsg(vpn))}</p><div class="dk-btn-row"><button class="dk-btn" data-act="vpn-restart" ${vpn.state == 'switching' ? 'disabled' : ''}>Restart VPN</button><a class="dk-btn" href="#/vpn">Nodes</a></div>${switchNote()}`);
	const dr = fmtRate(rate ? rate.down : null), ur = fmtRate(rate ? rate.up : null);
	const rx = fmtBytes(up ? up.rx_bytes : null).split(' ');
	const ut = fmtDur(st.info.uptime).split(' ');
	const tile = (n, v, u, data, c) => `<div class="dk-tile"><span class="dk-label">${esc(n)}</span><span class="v">${esc(v)} <small>${esc(u)}</small></span>${spark(data, c)}</div>`;
	row += card('Readouts', `<div class="dk-tiles">${tile('Download', dr[0], dr[1], state.hist.down, 'var(--dk-amber)')}${tile('Upload', ur[0], ur[1], state.hist.up, 'var(--dk-blue)')}${tile(`Received via ${up ? up.name : '—'}`, rx[0], rx[1] || '', [], 'transparent')}${tile('Router uptime', ut.slice(0, 2).join(' '), ut.slice(2).join(' '), [], 'transparent')}</div><p class="dk-note">Measured on the router every 5 s.</p>`);
	if ((st.uplinks || []).length) row += card('Internet sources', sourcesList(st, false) + `<p class="dk-note">The working uplink with the lowest metric is used.</p>`, [ 'Details', '#/network' ]);
	out += `<div class="dk-grid">${row}</div>`;

	/* row: devices, health, timeline */
	let row2 = '';
	const tb = online_devs.slice(0, 6).map((d) => `<tr><td><span class="n">${esc(d.name || 'Unknown device')}</span><span class="m">${esc(d.ip || '')} · ${(d.via || '').indexOf('wifi:') == 0 ? 'Wi-Fi' : 'cable'}</span></td><td class="dk-mono" style="font-size:13px;text-align:right">${d.signal != null ? d.signal + ' dBm' : ''}</td></tr>`).join('');
	row2 += card(`Who is online · ${online_devs.length}`, online_devs.length ? `<div class="dk-table-wrap"><table class="dk-table"><tbody>${tb}</tbody></table></div>` : empty('No devices online', 'Connect a phone or laptop and it shows up here.'), [ 'All devices', '#/devices' ]);
	row2 += card('Router health', healthBlocks(st) + `<p class="dk-note">${esc(st.board.model)} · up ${esc(fmtDur(st.info.uptime))} · load ${(st.info.load[0] / 65536).toFixed(2)}</p>`, [ 'System', '#/system' ]);
	if ((state.evs || []).length) row2 += card('Timeline', timeline(state.evs.slice(0, 7)), [ 'Full log', '/cgi-bin/luci/admin/status/logs' ]);
	out += `<div class="dk-grid-wide">${row2}</div>`;
	return out;
}

function sourcesList(st, detailed) {
	const up = activeUplink(st);
	return `<ol class="dk-src" aria-label="Internet sources in priority order">${(st.uplinks || []).slice().sort((a, b) => a.metric - b.metric).map((u, i) => {
		const active = up && u.name == up.name;
		const s = active ? [ 'In use', u.wireless ? 'blue' : 'ok' ] : u.up ? [ 'Standby', 'off' ] : [ u.wireless ? 'Not connected' : (u.carrier ? 'No address' : 'Unplugged'), 'off' ];
		const meta = u.wireless ? `${u.ssid || ''} · ${u.signal != null ? u.signal + ' dBm' : '—'} · ${u.ipv4 || 'no address'}` : `${u.device || ''} · ${u.ipv4 ? u.ipv4 + ' via ' + (u.gateway || '?') : 'no address'}`;
		let extra = '';
		if (detailed) extra = `<dl class="kv"><dt>Interface</dt><dd>${esc(u.name)} · ${esc(u.proto)}</dd><dt>Device</dt><dd>${esc(u.device || '—')}</dd><dt>Gateway</dt><dd>${esc(u.gateway || '—')}</dd><dt>Priority (metric)</dt><dd>${esc(u.metric)}</dd><dt>Up for</dt><dd>${u.up ? esc(fmtDur(u.uptime)) : '—'}</dd><dt>Received</dt><dd>${esc(fmtBytes(u.rx_bytes))}</dd></dl>`;
		return `<li class="${active ? 'active' : ''} ${u.wireless ? 'wifi' : ''}"><div class="row" style="display:flex;border:0;padding:0"><span class="name">${i + 1} · ${esc(u.wireless ? 'Wi-Fi uplink' : 'Cable')} (${esc(u.name)})</span>${tag(s[0], s[1])}</div><span class="meta">${esc(meta)}</span>${u.wireless ? bars(sigBars(u.signal), u.up ? 'var(--dk-blue)' : null) : ''}${extra}</li>`;
	}).join('')}</ol>`;
}

function healthBlocks(st) {
	const mem = st.info.memory, used = mem.total - (mem.available || mem.free), ov = st.storage.overlay || {};
	const block = (name, pct, sub, warn) => {
		const n = Math.round(Math.min(100, Math.max(0, pct)) / 100 * 12), c = pct >= warn ? 'var(--dk-amber)' : 'var(--dk-ink)';
		return `<figure class="block"><span class="dk-mono" style="font-size:13px">${Math.round(pct)} %</span><span class="col" role="img" aria-label="${esc(name)} ${Math.round(pct)} percent">${Array.from({ length: 12 }, (_, i) => `<span style="background:${i < n ? c : 'transparent'}"></span>`).join('')}</span><figcaption>${esc(name)}<small>${esc(sub)}</small></figcaption></figure>`;
	};
	const items = [ block('Load', st.info.load[0] / 65536 * 100, (st.info.load[0] / 65536).toFixed(2), 85), block('RAM', used / mem.total * 100, `${fmtBytes(used)} / ${fmtBytes(mem.total)}`, 75) ];
	if (st.storage.builtin && st.storage.builtin.total) items.push(block('Flash', (st.storage.builtin.total - st.storage.builtin.free) / st.storage.builtin.total * 100, `${fmtBytes(st.storage.builtin.total - st.storage.builtin.free)} / ${fmtBytes(st.storage.builtin.total)}`, 85));
	if (ov.total) items.push(block(ov.external ? 'USB' : 'Storage', (ov.total - ov.free) / ov.total * 100, `${fmtBytes(ov.total - ov.free)} / ${fmtBytes(ov.total)}`, 85));
	if (st.temperature != null) items.push(block('Temp', st.temperature, st.temperature.toFixed(0) + ' °C', 75));
	return `<div class="blocks">${items.join('')}</div>`;
}

function timeline(evs) {
	const c = { deck: 'var(--dk-green)', net: 'var(--dk-blue)', vpn: 'var(--dk-amber)', system: 'var(--dk-dim)' };
	return `<ol class="dk-timeline">${evs.map((e) => `<li style="--c:${c[e.kind] || 'var(--dk-blue)'}"><span class="t">${esc(e.time)}</span><span class="x">${esc(e.text)}</span></li>`).join('')}</ol>`;
}

function pageVpn() {
	const st = state.st, vpn = st.vpn;
	if (!vpn) return head('VPN', 'No VPN app') + empty('No VPN app found', 'Install a supported VPN app (PassWall 2 today) and this page fills in.');
	let out = head(`VPN · ${vpn.app}${vpn.core ? ' · ' + vpn.core : ''}`, 'Nodes & routing');
	const stt = { on: [ 'Running', 'ok' ], switching: [ 'Switching', 'warn' ], failed: [ 'Core not running', 'bad' ], off: [ 'Off', 'off' ] }[vpn.state];
	out += `<div class="dk-grid">${card('VPN switch', vpnSwitch(vpn) + `<p class="dk-sub">${esc(vpnMsg(vpn))}</p><div class="dk-btn-row"><button class="dk-btn" data-act="vpn-restart">Restart VPN</button><a class="dk-btn" href="/cgi-bin/luci/${esc(vpn.luci)}" target="_blank" rel="noopener">All ${esc(vpn.app)} settings</a></div>${switchNote()}`)}
		${card('Status', `<div>${tag(stt[0], stt[1])}</div><dl class="kv"><dt>App</dt><dd>${esc(vpn.app)}</dd><dt>Core</dt><dd>${esc(vpn.core || '—')}</dd><dt>Active node</dt><dd>${esc(vpn.node ? vpn.node.name : '—')}</dd><dt>Routing</dt><dd>${vpn.shunt ? 'rule-based' : 'everything through the node'}</dd></dl>`)}</div>`;

	const nodes = ((state.nodes && state.nodes.nodes) || []).filter((n) => n.complete && !n.shunt);
	const rows = nodes.map((n) => {
		const on = vpn.node && vpn.node.id == n.id;
		return `<tr class="${on ? '' : ''}" style="${on ? 'background:var(--dk-sunk)' : ''}">
			<td style="width:56px"><button class="dk-radio" style="width:44px;min-height:44px;grid-template-columns:1fr;justify-items:center;padding:0" role="radio" aria-checked="${on}" aria-label="Use ${esc(n.name)}" data-act="node" data-id="${esc(n.id)}" data-name="${esc(n.name)}"><span class="dot"></span></button></td>
			<td><span class="n">${esc(n.name)}</span><span class="m">server hidden</span></td>
			<td class="dk-mono" style="font-size:13px">${esc((n.protocol || n.type || '').toUpperCase())}${n.transport ? ' · ' + esc(n.transport) : ''}</td>
			<td>${n.tls ? tag('TLS', 'ok') : tag('No TLS', 'warn')}</td>
			<td style="text-align:right">${on ? tag('In use', 'ok') : ''}</td></tr>`;
	}).join('');
	let nb = nodes.length ? `<div class="dk-table-wrap"><table class="dk-table" style="min-width:620px"><thead><tr><th>Use</th><th>Node</th><th>Type</th><th>Encryption</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No nodes yet', 'Add a node link or a subscription in the app settings.');
	if (nodes.some((n) => !n.tls)) nb += `<div class="dk-banner warn" style="font-size:16px">Nodes marked “No TLS” send traffic between the router and the server unencrypted. Ask your provider for a TLS or REALITY link when you can.</div>`;
	out += card(`Your nodes · ${nodes.length}`, nb + `<p class="dk-note">Server addresses and keys are never shown here.</p>`, [ 'Add or edit nodes', `/cgi-bin/luci/${vpn.luci}` ]);

	if (state.rules && state.rules.shunt) {
		const rl = state.rules.rules.map((r, i) => `<li style="list-style:none;display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 12px;background:var(--dk-sunk);border:1px solid var(--dk-line);border-radius:2px">
			<span class="dk-mono dk-dim" style="font-size:13px">${i + 1}</span><span><span style="display:block;font-size:19px;font-weight:700">${esc(r.name)}</span><span class="dk-mono dk-dim" style="font-size:12px">${r.id == '_default' ? 'everything not matched above' : [ r.domains ? r.domains + ' domain rules' : '', r.ips ? r.ips + ' IP ranges' : '' ].filter(Boolean).join(' · ') || 'empty'}${r.used ? '' : ' · not used'}</span></span>
			${tag(r.target || 'not set', r.target == 'Direct' ? 'off' : r.target == 'Block' ? 'bad' : r.target ? 'ok' : 'off')}</li>`).join('');
		out += card('Routing · checked top to bottom', `<ol style="margin:0;padding:0;display:flex;flex-direction:column;gap:6px">${rl}</ol><p class="dk-note">Edit rules and their targets in the app settings.</p>`, [ 'Edit rules', `/cgi-bin/luci/${vpn.luci}` ]);
	}
	return out;
}

function pageNetwork() {
	const st = state.st;
	let out = head('Network', 'Internet & Wi-Fi');
	const dirty = Object.keys(state.edits).length > 0;
	out += card('Where internet comes from · in order', (st.uplinks || []).length ? sourcesList(st, true) + `<p class="dk-note">Change priority with the metric under Interfaces › Advanced settings.</p>` : empty('No internet source configured', 'Plug a cable into the WAN port, or join another Wi-Fi network below.'), [ 'Interfaces', '/cgi-bin/luci/admin/network/network' ]);

	const wcfg = state.wifiCfg || {};
	const radios = st.wifi || [];
	let wifiCards = '';
	for (const r of radios) {
		const rc = wcfg[r.radio] || {};
		for (const i of r.interfaces) {
			if (i.mode != 'ap') continue;
			const sc = wcfg[i.section] || {};
			const val = (k, d) => (state.edits[`${i.section}.${k}`] != null ? state.edits[`${i.section}.${k}`] : (sc[k] != null ? sc[k] : d));
			const chan = state.edits[`${r.radio}.channel`] != null ? state.edits[`${r.radio}.channel`] : (rc.channel || 'auto');
			const chans = r.band == '5g' ? [ 'auto', '36', '40', '44', '48', '149', '153', '157', '161' ] : [ 'auto', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13' ];
			const enc = val('encryption', 'none');
			wifiCards += card(`${i.ssid || i.section} · ${BAND[r.band] || ''}`, `
				<div class="field"><label for="ss-${i.section}">Name</label><input class="in" id="ss-${i.section}" data-edit="${i.section}.ssid" value="${esc(val('ssid', ''))}" maxlength="32"></div>
				<div class="field"><label for="ky-${i.section}">Password</label><div class="pwrow"><input class="in" id="ky-${i.section}" type="password" data-edit="${i.section}.key" value="${esc(val('key', ''))}" ${enc == 'none' ? 'disabled' : ''} minlength="8" maxlength="63"><button class="dk-btn" data-act="reveal" data-for="ky-${i.section}" aria-label="Show password" style="padding:0 12px">${svg('eye', 'width="20" height="20"')}</button></div></div>
				<div class="field"><label for="en-${i.section}">Security</label><select class="in" id="en-${i.section}" data-edit="${i.section}.encryption">${[ [ 'psk2', 'WPA2' ], [ 'sae-mixed', 'WPA2 / WPA3' ], [ 'sae', 'WPA3' ], [ 'none', 'Open (no password)' ] ].map((o) => `<option value="${o[0]}" ${enc == o[0] || (enc.indexOf(o[0] + '+') == 0) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
				<div class="field"><label for="ch-${r.radio}">Channel</label><select class="in" id="ch-${r.radio}" data-edit="${r.radio}.channel">${chans.map((c) => `<option ${String(chan) == c ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="help">Radio ${esc(r.radio)} is now on channel ${esc(r.channel || '?')}. ${r.interfaces.some((x) => x.mode == 'sta') ? 'This radio also carries the Wi-Fi uplink, which decides its channel.' : ''}</span></div>
				<div class="field"><span class="lbl">Clients</span><span>${tag((i.clients || 0) + ' connected', 'ok')}</span></div>`, [ 'All Wi-Fi options', '/cgi-bin/luci/admin/network/wireless' ]);
		}
	}
	out += wifiCards ? `<div class="dk-grid-wide">${wifiCards}</div>` : card('Your Wi-Fi', empty('No Wi-Fi network is broadcast', radios.length ? 'Add one under All Wi-Fi options.' : 'This router has no Wi-Fi radio.'), radios.length ? [ 'All Wi-Fi options', '/cgi-bin/luci/admin/network/wireless' ] : null);

	const sta = radios.map((r) => r.interfaces.find((i) => i.mode == 'sta' && i.ifname)).find(Boolean);
	if (sta) {
		let list = '';
		if (state.scan) list = state.scan.length ? `<div class="rows">${state.scan.map((w) => `<div class="row"><span>${bars(sigBars(w.signal))}</span><span style="min-width:0"><span class="t">${esc(w.ssid)}</span><span class="s">ch ${esc(w.channel || '?')} · ${esc(w.enc.toUpperCase())} · ${w.signal != null ? Math.round(w.signal) + ' dBm' : ''}${w.dfs ? ' · DFS' : ''}</span></span><span>${w.ssid == sta.ssid ? tag('Connected', 'ok') : w.dfs ? tag('Can’t use', 'off') : `<a class="dk-btn" href="/cgi-bin/luci/admin/network/wireless" target="_blank" rel="noopener">Join</a>`}</span></div>`).join('')}</div>` : empty('Nothing found', 'Try again, or move the router closer.');
		else list = `<p class="dk-note">Scan to see networks this router can join for internet. The current uplink is ${esc(sta.ssid || '—')}.</p>`;
		out += card(`Join another Wi-Fi for internet`, `<div><button class="dk-btn" data-act="scan" data-dev="${esc(sta.ifname)}">${state.scanning ? 'Scanning…' : 'Scan'}</button></div>${list}<p class="dk-note">Channels 52–144 (DFS) usually can’t be used by a client radio and are marked.</p>`);
	}

	out += card('All network settings', `<div class="dk-btn-row">${[ [ 'Interfaces', 'admin/network/network' ], [ 'Wireless', 'admin/network/wireless' ], [ 'DHCP', 'admin/network/dhcp' ], [ 'DNS', 'admin/network/dns' ], [ 'Firewall', 'admin/network/firewall' ], [ 'Routing', 'admin/network/routes' ], [ 'Diagnostics', 'admin/network/diagnostics' ] ].map((l) => `<a class="dk-btn" href="/cgi-bin/luci/${l[1]}" target="_blank" rel="noopener">${l[0]}</a>`).join('')}</div>`);
	if (dirty) out += `<div class="applybar" role="status"><span>Unsaved Wi-Fi changes. Wi-Fi restarts for about 10 s.</span><span style="display:flex;gap:8px"><button class="dk-btn" data-act="discard">Discard</button><button class="dk-btn dk-btn-amber" data-act="apply-wifi">Apply</button></span></div>`;
	return out;
}

function pageDevices() {
	const devs = (state.devs || []).slice().sort((a, b) => (b.online - a.online) || String(a.name || '~').localeCompare(String(b.name || '~')));
	const f = state.filter;
	const counts = { online: devs.filter((d) => d.online).length, wifi: devs.filter((d) => (d.via || '').indexOf('wifi:') == 0).length, cable: devs.filter((d) => d.via == 'cable').length, all: devs.length };
	const shown = devs.filter((d) => f == 'all' || (f == 'online' && d.online) || (f == 'wifi' && (d.via || '').indexOf('wifi:') == 0) || (f == 'cable' && d.via == 'cable'));
	if (!state.sel || !devs.find((d) => d.mac == state.sel)) state.sel = shown[0] ? shown[0].mac : null;
	const sel = devs.find((d) => d.mac == state.sel);
	let out = head(`${counts.online} online · ${counts.all} known`, 'Devices');
	out += `<div class="chips" role="group" aria-label="Filter devices">${[ [ 'online', 'Online' ], [ 'wifi', 'Wi-Fi' ], [ 'cable', 'Cable' ], [ 'all', 'All' ] ].map((x) => `<button class="dk-btn ${f == x[0] ? 'dk-btn-ink' : ''}" aria-pressed="${f == x[0]}" data-act="filter" data-f="${x[0]}">${x[1]} <span class="dk-mono" style="font-size:12px">${counts[x[0]]}</span></button>`).join('')}</div>`;
	const list = shown.length ? `<div class="rows">${shown.map((d) => { const wifi = (d.via || '').indexOf('wifi:') == 0; return `<button class="row" aria-pressed="${d.mac == state.sel}" data-act="pick" data-mac="${esc(d.mac)}" style="${d.online ? '' : 'opacity:.6'}"><span class="ic">${svg(wifi ? 'phone' : 'laptop')}</span><span style="min-width:0"><span class="t">${esc(d.name || 'Unknown device')}</span><span class="s">${esc(d.ip || '—')} · ${wifi ? 'Wi-Fi ' + esc(d.via.slice(5)) : d.via == 'cable' ? 'cable' : 'offline'}</span></span><span>${d.online ? tag('Online', 'ok') : tag('Offline', 'off')}</span></button>`; }).join('')}</div>` : empty('No devices here', 'Connect a phone or laptop and it shows up within a few seconds.');
	let side = '';
	if (sel) {
		const wifi = (sel.via || '').indexOf('wifi:') == 0;
		side = card('Selected device', `<div style="font-size:26px;font-weight:700;line-height:1.1">${esc(sel.name || 'Unknown device')}</div>
			<dl class="kv"><dt>IP address</dt><dd>${esc(sel.ip || '—')}</dd><dt>MAC</dt><dd>${esc(sel.mac)}</dd><dt>Connected</dt><dd>${wifi ? 'Wi-Fi ' + esc(sel.via.slice(5)) : sel.via == 'cable' ? 'cable' : 'not now'}</dd>
			${sel.signal != null ? `<dt>Signal</dt><dd>${esc(sel.signal)} dBm</dd>` : ''}${sel.rx_rate ? `<dt>Link rate</dt><dd>${esc(sel.rx_rate)} / ${esc(sel.tx_rate)} Mbit/s</dd>` : ''}${sel.lease ? `<dt>Lease ends</dt><dd>${esc(new Date(sel.lease * 1000).toLocaleString())}</dd>` : ''}</dl>
			<div class="dk-btn-row"><a class="dk-btn" href="/cgi-bin/luci/admin/network/dhcp" target="_blank" rel="noopener">Name / keep this IP</a></div>
			<p class="dk-note">Names come from DHCP. Give a device a fixed name and address under DHCP › Static leases.</p>`);
	}
	out += `<div class="split"><div class="main">${card('Devices', list)}</div><div class="side">${side}</div></div>`;
	return out;
}

function pageSystem() {
	const st = state.st, caps = state.caps, cfg = state.deckCfg || {};
	const yes = (ok) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${ok ? 'var(--dk-green)' : 'var(--dk-dim)'}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="${ok ? ICON.yes : ICON.no}"></path></svg>`;
	const cap = (n, s, ok) => `<li class="${ok ? '' : 'no'}">${yes(ok)}<span><span class="nm">${esc(n)}</span><span class="dk-mono dk-dim" style="font-size:12px">${esc(s)}</span></span></li>`;
	const leds = caps.leds || [], buttons = caps.buttons || [];
	let out = head('Settings that rarely change', 'System');
	out += card('Found on this router', `<ul class="dk-caps">
		${cap('VPN app', caps.vpn ? caps.vpn.app : 'none installed', !!caps.vpn)}
		${cap('Status LEDs', leds.length ? leds.map((l) => l.name).join(', ') : 'none usable', leds.length > 0)}
		${cap('Buttons & switches', buttons.length ? buttons.map((b) => b.label + (b.switch ? ' (switch)' : '')).join(', ') : 'none found', buttons.length > 0)}
		${cap('Wi-Fi radios', String(caps.radios || 0), (caps.radios || 0) > 0)}
		${cap('Backup internet', (caps.uplinks || []).length > 1 ? (caps.uplinks || []).join(', ') : 'single uplink', (caps.uplinks || []).length > 1)}
		${cap('External storage', caps.external_storage ? 'apps and settings on USB' : 'built-in flash only', !!caps.external_storage)}
		${cap('Temperature sensor', caps.temperature ? 'available' : 'not on this hardware', !!caps.temperature)}
	</ul><p class="dk-note">Settings for missing features are hidden. Nothing here is specific to one router model.</p>`);

	const ledc = cfg.led || {}, mon = cfg.monitor || {}, vb = cfg.vpn_button || {};
	const e = (k, d) => (state.edits[k] != null ? state.edits[k] : d);
	let settings = `<div class="field"><span class="lbl">Check the internet</span><button class="toggle" role="switch" aria-checked="${e('monitor.enabled', mon.enabled || '1') == '1'}" data-act="tgl" data-key="monitor.enabled" aria-label="Check the internet"><i></i></button><span class="help">Needed for the “No internet” status and the LED.</span></div>
		<div class="field"><label for="mi">Check every (seconds)</label><input class="in" id="mi" type="number" min="5" max="600" data-edit="monitor.interval" value="${esc(e('monitor.interval', mon.interval || '15'))}"></div>`;
	if (leds.length) settings += `<div class="field"><span class="lbl">Show status on the LED</span><button class="toggle" role="switch" aria-checked="${e('led.enabled', ledc.enabled || '0') == '1'}" data-act="tgl" data-key="led.enabled" aria-label="Show status on the LED"><i></i></button><span class="help">Solid = VPN on. Fast blink = switching. Short blip = VPN off. Alert blinking = VPN core failed, solid = no internet.</span></div>
		<div class="field"><label for="ol">LED for “all good”</label><select class="in" id="ol" data-edit="led.ok_led"><option value="">— none —</option>${leds.map((l) => `<option ${e('led.ok_led', ledc.ok_led) == l.name ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
		<div class="field"><label for="al">LED for problems</label><select class="in" id="al" data-edit="led.alert_led"><option value="">— same as “all good” —</option>${leds.map((l) => `<option ${e('led.alert_led', ledc.alert_led) == l.name ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>`;
	if (caps.vpn && buttons.filter((b) => b.name != 'reset').length) settings += `<div class="field"><label for="vb">VPN switch on the router</label><select class="in" id="vb" data-edit="vpn_button.name"><option value="">— not used —</option>${buttons.filter((b) => b.name != 'reset').map((b) => `<option value="${esc(b.name)}" ${e('vpn_button.name', vb.name) == b.name ? 'selected' : ''}>${esc(b.label)} (${esc(b.name)}${b.switch ? ', switch' : ''}) · now ${esc(b.state || '?')}${b.handler && b.handler.indexOf('/usr/libexec/deck') < 0 ? ' · has its own script' : ''}</option>`).join('')}</select><span class="help">A button that already has its own script is left alone.</span></div>
		<div class="field"><label for="ve">VPN is on when the switch is</label><select class="in" id="ve" data-edit="vpn_button.on_event">${[ 'pressed', 'released' ].map((o) => `<option ${e('vpn_button.on_event', vb.on_event || 'pressed') == o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
	out += card('Dashboard settings', settings);

	const s = st.storage, meters = [];
	const meter = (n, pct, v) => `<div class="dk-meter"><span class="dk-meter-name">${esc(n)}</span><span class="dk-meter-track" aria-hidden="true"><span class="dk-meter-fill ${pct >= 85 ? 'dk-warn' : ''}" style="width:${Math.min(100, pct).toFixed(0)}%"></span></span><span class="dk-mono dk-meter-val">${esc(v)}</span></div>`;
	if (s.overlay && s.overlay.total) meters.push(meter(s.overlay.external ? 'USB' : 'Storage', (s.overlay.total - s.overlay.free) / s.overlay.total * 100, `${fmtBytes(s.overlay.total - s.overlay.free)} / ${fmtBytes(s.overlay.total)}`));
	if (s.builtin && s.builtin.total) meters.push(meter('Built-in', (s.builtin.total - s.builtin.free) / s.builtin.total * 100, `${fmtBytes(s.builtin.total - s.builtin.free)} / ${fmtBytes(s.builtin.total)}`));
	if (s.tmp && s.tmp.total) meters.push(meter('RAM disk', (s.tmp.total - s.tmp.free) / s.tmp.total * 100, `${fmtBytes(s.tmp.total - s.tmp.free)} / ${fmtBytes(s.tmp.total)}`));
	let grid = card('Storage', meters.join('') + `<p class="dk-note">${s.overlay && s.overlay.external ? `Apps and settings live on the USB stick (${esc(s.overlay.device)}). Keep it plugged in.` : 'Apps and settings live in the built-in flash.'}</p>`, [ 'Mount points', '/cgi-bin/luci/admin/system/mounts' ]);
	grid += card('Backups & updates', `<div class="dk-btn-row"><a class="dk-btn dk-btn-amber" href="/cgi-bin/luci/admin/system/flash" target="_blank" rel="noopener">Back up / restore</a><a class="dk-btn" href="/cgi-bin/luci/admin/system/package-manager" target="_blank" rel="noopener">Software</a><a class="dk-btn" href="/cgi-bin/luci/admin/system/admin" target="_blank" rel="noopener">Router password</a></div><p class="dk-note">These open the full LuCI pages.</p>`);
	grid += card('Recent events', (state.evs || []).length ? timeline(state.evs.slice(0, 10)) : empty('Nothing logged yet', 'Events from the VPN, uplinks and the dashboard show up here.'), [ 'Full log', '/cgi-bin/luci/admin/status/logs' ]);
	grid += card('About', `<div style="font-size:34px;font-weight:700;line-height:1">Deck <span class="dk-mono dk-dim" style="font-size:15px;font-weight:400">v${VERSION}</span></div><p class="dk-sub">A simple dashboard for OpenWrt routers. Free and open source under the Apache-2.0 licence.</p><dl class="kv"><dt>Router</dt><dd>${esc(st.board.model)}</dd><dt>System</dt><dd>${esc(st.board.release.description)}</dd><dt>Chip</dt><dd>${esc(st.board.system)}</dd></dl>`);
	out += `<div class="dk-grid-wide">${grid}</div>`;
	out += `<section class="dk-card" style="border-color:var(--dk-red);background-image:repeating-linear-gradient(-45deg,transparent 0 10px,rgba(255,90,78,.06) 10px 20px)"><div class="dk-card-head"><h2 class="dk-h2" style="color:var(--dk-red)">Power</h2></div><p class="dk-sub">Restarting takes about two minutes. Settings are kept.</p><div><button class="dk-btn dk-btn-red" data-act="reboot">Restart router…</button></div></section>`;
	if (Object.keys(state.edits).length) out += `<div class="applybar" role="status"><span>Unsaved dashboard settings.</span><span style="display:flex;gap:8px"><button class="dk-btn" data-act="discard">Discard</button><button class="dk-btn dk-btn-amber" data-act="apply-deck">Save</button></span></div>`;
	return out;
}

/* ---------------- login ---------------- */
let loginHost = null;
async function hostname() {
	if (loginHost) return loginHost;
	try {
		const html = await (await fetch('/cgi-bin/luci/', { credentials: 'omit', cache: 'no-store' })).text();
		const m = html.match(/<title>([^<|]+)/);
		loginHost = m ? m[1].trim() : 'OpenWrt';
	} catch (e) { loginHost = 'OpenWrt'; }
	return loginHost;
}

async function renderLogin(msg, bad) {
	const host = await hostname();
	document.title = `${host} · Deck`;
	root.innerHTML = `<div class="login">
		<section><form class="login-card" id="lf" autocomplete="on">
			<div class="dk-mono dk-dim" style="font-size:13px">Deck · OpenWrt router</div>
			<h1 class="login-host">${esc(host)}</h1>
			${msg ? `<div class="dk-banner ${bad ? 'bad' : ''}" role="alert" style="font-size:17px">${esc(msg)}</div>` : ''}
			<input type="text" name="username" value="root" autocomplete="username" hidden>
			<label><span>Router password</span><span class="pwrow"><input class="in" id="pw" name="password" type="password" autocomplete="current-password" required><button type="button" class="dk-btn" data-act="reveal" data-for="pw" aria-label="Show password" style="padding:0 14px">${svg('eye', 'width="22" height="22"')}</button></span></label>
			<label class="login-check"><input type="checkbox" id="rem"> Stay logged in on this device</label>
			<button class="dk-btn dk-btn-amber go" type="submit">Log in</button>
			<p class="dk-note">The same root password as LuCI and SSH. Forgot it? Holding the reset button erases all settings.</p>
		</form></section>
		<section><div class="login-side"><div class="dk-label">What you get</div><h2>Your router at a glance</h2>
			<p class="dk-sub">VPN on and off, where your internet comes from, who is online, and how the router is doing. Everything else stays in LuCI.</p>
			<ul class="dk-caps"><li>${svg('vpn', 'width="18" height="18"')}<span><span class="nm">VPN switch</span><span class="dk-mono dk-dim" style="font-size:12px">when a VPN app is installed</span></span></li><li>${svg('net', 'width="18" height="18"')}<span><span class="nm">Internet sources</span><span class="dk-mono dk-dim" style="font-size:12px">cable and Wi-Fi backup</span></span></li><li>${svg('dev', 'width="18" height="18"')}<span><span class="nm">Devices</span><span class="dk-mono dk-dim" style="font-size:12px">who is online now</span></span></li><li>${svg('sys', 'width="18" height="18"')}<span><span class="nm">Router health</span><span class="dk-mono dk-dim" style="font-size:12px">LED, buttons, storage</span></span></li></ul>
		</div></section></div>`;
	$('#pw').focus();
	$('#lf').addEventListener('submit', async (ev) => {
		ev.preventDefault();
		const btn = $('#lf .go');
		btn.disabled = true; btn.textContent = 'Logging in…';
		try {
			await login($('#pw').value, $('#rem').checked);
			state.notice = null;
			render();
		} catch (e) {
			renderLogin(e.code === 'session' || e.code === -32002 ? 'That password didn’t work. Try again.' : 'Can’t reach the router right now.', true);
		}
	});
}

/* ---------------- render loop ---------------- */
const SCREENS = { home: pageHome, vpn: pageVpn, network: pageNetwork, devices: pageDevices, system: pageSystem };
let timer = null, rendering = false, pending = false;

async function render() {
	if (!SID) { clearTimeout(timer); return renderLogin(state.notice); }
	if (rendering) { pending = true; return; }
	rendering = true;
	let page = route();
	if (!SCREENS[page]) page = 'home';
	try {
		await load(page);
		if (page == 'vpn' && !state.caps.vpn) page = 'home';
		const focus = document.activeElement && document.activeElement.id;
		const scroll = window.scrollY;
		document.title = `${state.st.board.hostname} · ${PAGES.find((p) => p[0] == page)[1]}`;
		root.innerHTML = shell(page, SCREENS[page]());
		if (focus && document.getElementById(focus)) document.getElementById(focus).focus();
		window.scrollTo(0, scroll);
	} catch (e) {
		if (e.code === 'session') { forget(); state.notice = 'Your session ended. Log in again.'; rendering = false; return renderLogin(state.notice); }
		if (!state.st) root.innerHTML = `<div class="page">${empty('Can’t reach the router', 'Retrying every few seconds.')}</div>`;
		else toast('Can’t reach the router. Showing the last values.', 'bad');
	}
	rendering = false;
	if (pending) { pending = false; return render(); }
	clearTimeout(timer);
	const editing = Object.keys(state.edits).length > 0;
	timer = setTimeout(() => { if (!document.hidden && !editing && !document.querySelector('.scrim')) render(); else timerRetry(); }, 5000);
}
function timerRetry() { clearTimeout(timer); timer = setTimeout(() => (document.hidden || document.querySelector('.scrim') ? timerRetry() : render()), 5000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && SID) render(); });
window.addEventListener('hashchange', () => { state.edits = {}; state.scan = null; render(); });

/* ---------------- actions ---------------- */
root.addEventListener('input', (ev) => {
	const el = ev.target.closest('[data-edit]');
	if (!el) return;
	state.edits[el.dataset.edit] = el.value;
	if (!$('.applybar')) render();
});
root.addEventListener('change', (ev) => {
	const el = ev.target.closest('select[data-edit]');
	if (!el) return;
	state.edits[el.dataset.edit] = el.value;
	render();
});

root.addEventListener('click', async (ev) => {
	const el = ev.target.closest('[data-act]');
	if (!el) return;
	const act = el.dataset.act;
	if (act == 'reveal') {
		const i = document.getElementById(el.dataset.for);
		if (i) { i.type = i.type == 'password' ? 'text' : 'password'; el.setAttribute('aria-label', i.type == 'password' ? 'Show password' : 'Hide password'); }
		return;
	}
	if (act == 'theme') {
		const dark = !root.classList.contains('dk-light');
		try { localStorage.setItem('deck.theme', dark ? 'light' : 'dark'); } catch (e) {}
		applyTheme(); render(); return;
	}
	if (act == 'logout') return logout();
	if (act == 'vpn-toggle') {
		const on = !state.st.vpn.enabled;
		state.busyUntil = Date.now() + 8000;
		try { await call('deck', 'vpn_set', { enabled: on }); toast(on ? 'Turning the VPN on…' : 'Turning the VPN off…', 'info'); } catch (e) { toast('Couldn’t change the VPN: ' + e.message, 'bad'); }
		return render();
	}
	if (act == 'vpn-restart') {
		state.busyUntil = Date.now() + 8000;
		try { await call('deck', 'vpn_restart'); toast('Restarting the VPN…', 'info'); } catch (e) { toast('Couldn’t restart the VPN.', 'bad'); }
		return render();
	}
	if (act == 'node') {
		if (el.getAttribute('aria-checked') == 'true') return;
		if (!(await confirmBox('Switch node?', `The VPN restarts on “${el.dataset.name}”. Connections drop for a few seconds.`, 'Switch'))) return;
		state.busyUntil = Date.now() + 8000;
		try { await call('deck', 'vpn_select', { node: el.dataset.id }); toast(`Switching to ${el.dataset.name}…`, 'info'); } catch (e) { toast('Couldn’t switch node.', 'bad'); }
		return render();
	}
	if (act == 'filter') { state.filter = el.dataset.f; state.sel = null; return render(); }
	if (act == 'pick') { state.sel = el.dataset.mac; return render(); }
	if (act == 'tgl') {
		const now = el.getAttribute('aria-checked') == 'true';
		state.edits[el.dataset.key] = now ? '0' : '1';
		return render();
	}
	if (act == 'discard') { state.edits = {}; state.wifiCfg = null; state.deckCfg = null; return render(); }
	if (act == 'scan') {
		state.scanning = true; render();
		try { const r = await call('deck', 'wifi_scan', { device: el.dataset.dev }); state.scan = r.results || []; } catch (e) { toast('Scan failed.', 'bad'); }
		state.scanning = false; return render();
	}
	if (act == 'apply-wifi') {
		const keys = Object.keys(state.edits);
		const bad = keys.find((k) => k.endsWith('.key') && state.edits[k].length < 8);
		if (bad) return toast('Wi-Fi passwords need at least 8 characters.', 'bad');
		if (!(await confirmBox('Apply Wi-Fi changes?', 'Wi-Fi restarts for about 10 seconds. If you changed the name or password of the network you are on, reconnect with the new one.', 'Apply'))) return;
		try {
			const bySec = {};
			keys.forEach((k) => { const [ sec, opt ] = k.split('.'); (bySec[sec] = bySec[sec] || {})[opt] = state.edits[k]; });
			for (const sec in bySec) await uciSet('wireless', sec, bySec[sec]);
			await uciCommit('wireless');
			await call('deck', 'wifi_reload');
			state.edits = {}; state.wifiCfg = null;
			toast('Saved. Wi-Fi is restarting.');
		} catch (e) { toast('Couldn’t save: ' + e.message, 'bad'); }
		return render();
	}
	if (act == 'apply-deck') {
		try {
			const bySec = {};
			Object.keys(state.edits).forEach((k) => { const [ sec, opt ] = k.split('.'); (bySec[sec] = bySec[sec] || {})[opt] = state.edits[k]; });
			for (const sec in bySec) await uciSet('deck', sec, bySec[sec]);
			await uciCommit('deck');
			state.edits = {}; state.deckCfg = null; state.caps = null;
			toast('Saved.');
		} catch (e) { toast('Couldn’t save: ' + e.message, 'bad'); }
		return render();
	}
	if (act == 'reboot') {
		if (!(await confirmBox('Restart the router?', 'Everyone loses internet for about two minutes. Settings are kept and the VPN comes back by itself.', 'Restart', 'red'))) return;
		try { await call('system', 'reboot'); } catch (e) {}
		root.innerHTML = `<div class="page" style="min-height:100vh;justify-content:center;align-items:center;text-align:center"><span class="led white blink" style="width:22px;height:22px"></span><h1 class="dk-title">Restarting</h1><p class="dk-sub">This page reconnects by itself.</p></div>`;
		clearTimeout(timer);
		const wait = () => setTimeout(async () => { try { await call('deck', 'capabilities'); render(); } catch (e) { if (e.code === 'session') { forget(); render(); } else wait(); } }, 5000);
		setTimeout(wait, 30000);
	}
});

render();
})();
