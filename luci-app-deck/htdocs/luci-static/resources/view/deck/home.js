'use strict';
'require view';
'require poll';
'require ui';
'require deck.common as dc';

/* SPDX-License-Identifier: Apache-2.0
 * Deck home: traffic path, VPN switch, readouts, sources, devices, health, timeline.
 * Every block checks capabilities first and is left out when the router lacks it. */

const hist = { down: [], up: [] };
let last = null;      // previous counter sample { t, rx, tx }
let busyUntil = 0;     // keep the switch disabled briefly after a click

function sample(st) {
	let rx = 0, tx = 0;
	for (const u of st.uplinks || []) if (u.up) { rx += u.rx_bytes; tx += u.tx_bytes; }
	const now = { t: st.time, rx, tx };
	let rate = null;
	if (last && now.t > last.t && rx >= last.rx && tx >= last.tx)
		rate = { down: (rx - last.rx) / (now.t - last.t), up: (tx - last.tx) / (now.t - last.t) };
	last = now;
	if (rate) {
		hist.down.push(rate.down); hist.up.push(rate.up);
		if (hist.down.length > 60) { hist.down.shift(); hist.up.shift(); }
	}
	return rate;
}

function activeUplink(st) {
	return (st.uplinks || []).find(u => u.up) || null;
}

function hop(kind, k, t, s, cls) {
	return E('li', { 'class': 'dk-hop ' + (kind || '') }, [
		E('span', { 'class': 'k' }, k), E('span', { 'class': 't' + (cls ? ' ' + cls : '') }, t), E('span', { 'class': 's' }, s || '')
	]);
}

function wire(kind, label, color) {
	const el = E('li', { 'class': 'dk-wire ' + (kind || ''), 'aria-hidden': 'true' }, [ E('span', {}, label || ''), E('i') ]);
	if (color) el.style.setProperty('--c', color);
	return el;
}

return view.extend({
	load() {
		return Promise.all([ dc.caps(), dc.status(), dc.devices(), dc.events(8) ]);
	},

	renderAll(caps, st, devs, evs) {
		const vpn = st.vpn;
		const online = st.net && st.net.online;
		const up = activeUplink(st);
		const rate = sample(st);
		const head = dc.vpnHead(vpn, online === false ? false : (up ? true : false));
		const children = [];

		/* banner */
		let banner = null;
		if (vpn && vpn.state == 'failed')
			banner = E('div', { 'class': 'dk-banner bad', role: 'status' }, [ E('span', {}, _('The VPN core is not running, so sites that need the VPN will not load.')), dc.btn(_('Restart VPN'), 'line', () => this.restart()) ]);
		else if (online === false || !up)
			banner = E('div', { 'class': 'dk-banner bad', role: 'status' }, [ E('span', {}, _('No internet on any uplink. The router keeps checking.')) ]);
		else if (up && up.wireless && (st.uplinks || []).some(u => !u.wireless && !u.up))
			banner = E('div', { 'class': 'dk-banner', role: 'status' }, [ E('span', {}, _('Cable unplugged. Running on the Wi-Fi uplink %s.').format(up.ssid || up.name)) ]);
		if (banner) children.push(banner);

		/* traffic path */
		const lanClients = (devs || []).filter(d => d.online).length;
		const path = E('ol', { 'class': 'dk-path', 'aria-label': _('How traffic leaves your network, hop by hop') });
		const g = 'var(--dk-green)', r = 'var(--dk-red)', a = 'var(--dk-amber)';
		path.appendChild(hop('', _('Devices'), String(lanClients), _('online now')));
		path.appendChild(wire('ok flow', '', g));
		path.appendChild(hop('ok', _('Router'), st.board.hostname, (Array.isArray(st.lan) ? st.lan[0] : st.lan || '').replace(/\/.*$/, '')));
		if (vpn) {
			const vs = vpn.state;
			path.appendChild(wire(vs == 'on' ? 'ok flow' : vs == 'switching' ? 'flow' : vs == 'failed' ? 'bad' : '', '', vs == 'switching' ? a : g));
			const nodeName = vpn.node ? vpn.node.name : _('no node');
			if (vs == 'on') path.appendChild(hop('ok', _('VPN tunnel'), nodeName, (vpn.node && vpn.node.protocol || '').toUpperCase()));
			else if (vs == 'switching') path.appendChild(hop('warn', _('VPN tunnel'), _('Switching'), vpn.core || '', 'blink'));
			else if (vs == 'failed') path.appendChild(hop('bad', _('VPN tunnel'), _('Down'), _('core not running')));
			else path.appendChild(hop('ghost', _('VPN tunnel'), _('Bypassed'), _('switch is off')));
			path.appendChild(wire(online === false || !up ? 'bad' : vs == 'on' ? 'ok flow' : '', vs == 'on' ? _('encrypted') : _('direct'), g));
		} else {
			path.appendChild(wire(up ? 'ok flow' : 'bad', '', g));
		}
		if (up) path.appendChild(hop(up.wireless ? 'blue' : 'ok', _('Internet · %s').format(up.name), up.wireless ? (up.ssid || _('Wi-Fi')) : _('Cable'), up.ipv4 || ''));
		else path.appendChild(hop('bad', _('Internet'), _('No link'), _('all uplinks down')));
		children.push(dc.card(_('Traffic path'), [ path ], { link: [ _('Network details'), dc.luci('admin/deck/network') ] }));

		/* switch + readouts + sources */
		const row = E('div', { 'class': 'dk-grid' });
		if (vpn) {
			const on = vpn.enabled;
			const color = { on: 'var(--dk-green)', switching: 'var(--dk-amber)', failed: 'var(--dk-red)', off: 'var(--dk-line)' }[vpn.state] || 'var(--dk-green)';
			const busy = vpn.state == 'switching' || Date.now() < busyUntil;
			const sw = E('button', { 'class': 'dk-switch', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': _('VPN'), click: () => this.toggle(!on) }, [
				E('span', { 'class': 'knob' }), E('span', { 'class': 'lbl off' }, _('OFF')),
				E('span', { 'class': 'lbl on' }, [ E('span', { 'class': busy ? 'blink' : '' }, vpn.state == 'switching' ? _('WAIT') : vpn.state == 'failed' ? _('FAILED') : _('VPN')) ])
			]);
			sw.style.setProperty('--c', color);
			if (busy) sw.disabled = true;
			const msg = { on: _('On, through %s.').format(vpn.node ? vpn.node.name : '?'), switching: _('Starting or stopping. Usually under a minute.'), failed: _('Switch is on but the VPN core is not running.'), off: _('Off. Every device goes straight to your provider.') }[vpn.state];
			const kids = [ sw, E('p', { 'class': 'dk-sub' }, msg),
				E('div', { 'class': 'dk-btn-row' }, [ dc.btn(_('Restart VPN'), 'line', () => this.restart(), busy ? { disabled: '' } : {}), E('a', { 'class': 'dk-btn', href: dc.luci('admin/deck/vpn') }, _('Nodes')) ]) ];
			const vb = st.vpn_button || {};
			const btn = vb.name ? (st.buttons || []).find(b => b.name == vb.name) : null;
			if (btn && btn.state) kids.push(E('p', { 'class': 'dk-note' }, _('The %s switch on the router is on the %s side. Whichever you change last wins.').format(btn.label, btn.state == vb.on_event ? _('VPN') : _('OFF'))));
			row.appendChild(dc.card(_('VPN switch'), kids));
		}

		const dr = dc.rate(rate ? rate.down : null), ur = dc.rate(rate ? rate.up : null);
		const tile = (name, v, unit, data, color) => E('div', { 'class': 'dk-tile' }, [
			E('span', { 'class': 'dk-label' }, name), E('span', { 'class': 'v' }, [ v, ' ', E('small', {}, unit) ]), dc.spark(data.length > 1 ? data : [ 0, 0 ], color) ]);
		row.appendChild(dc.card(_('Readouts'), [ E('div', { 'class': 'dk-tiles' }, [
			tile(_('Download'), dr[0], dr[1], hist.down, 'var(--dk-amber)'),
			tile(_('Upload'), ur[0], ur[1], hist.up, 'var(--dk-blue)'),
			tile(_('Received via %s').format(up ? up.name : '—'), dc.bytes(up ? up.rx_bytes : null).split(' ')[0], (dc.bytes(up ? up.rx_bytes : null).split(' ')[1] || ''), [ 0, 0 ], 'var(--dk-line)'),
			tile(_('Router uptime'), dc.dur(st.info.uptime).split(' ').slice(0, 2).join(' '), dc.dur(st.info.uptime).split(' ').slice(2).join(' '), [ 0, 0 ], 'var(--dk-line)')
		]), E('p', { 'class': 'dk-note' }, _('Speeds are measured on the router every 5 s.')) ]));

		if ((st.uplinks || []).length) {
			const list = E('ol', { 'class': 'dk-src', 'aria-label': _('Internet sources in priority order') });
			(st.uplinks || []).slice().sort((x, y) => x.metric - y.metric).forEach((u, i) => {
				const active = up && u.name == up.name;
				const state = active ? [ _('In use'), u.wireless ? 'blue' : 'ok' ] : u.up ? [ _('Standby'), 'off' ] : [ u.wireless ? _('Down') : (u.carrier ? _('Down') : _('Unplugged')), 'off' ];
				const meta = u.wireless ? `${u.ssid || ''} · ${u.signal != null ? u.signal + ' dBm' : ''} · ${u.ipv4 || _('no address')}` : `${u.device || ''} · ${u.ipv4 ? u.ipv4 + ' via ' + (u.gateway || '?') : _('no address')}`;
				list.appendChild(E('li', { 'class': (active ? 'active' : '') + (u.wireless ? ' wifi' : '') }, [
					E('div', { 'class': 'row' }, [ E('span', { 'class': 'name' }, `${i + 1} · ${u.name}`), dc.tag(state[0], state[1]) ]),
					E('span', { 'class': 'meta' }, meta),
					u.wireless ? dc.bars(dc.signalBars(u.signal), u.up ? 'var(--dk-blue)' : null) : ''
				]));
			});
			row.appendChild(dc.card(_('Internet sources'), [ list, E('p', { 'class': 'dk-note' }, _('The router uses the lowest-metric uplink that is up.')) ], { link: [ _('Details'), dc.luci('admin/deck/network') ] }));
		}
		children.push(row);

		/* devices, health, timeline */
		const row2 = E('div', { 'class': 'dk-grid-wide' });
		const online_devs = (devs || []).filter(d => d.online);
		const tb = E('tbody');
		online_devs.slice(0, 6).forEach(d => tb.appendChild(E('tr', {}, [
			E('td', {}, [ E('span', { 'class': 'n' }, d.name || _('Unknown device')), E('span', { 'class': 'm' }, `${d.ip || ''} · ${d.via && d.via.indexOf('wifi:') == 0 ? 'Wi-Fi' : _('cable')}`) ]),
			E('td', { 'class': 'dk-mono', style: 'font-size:13px;text-align:right' }, d.signal != null ? d.signal + ' dBm' : '')
		])));
		row2.appendChild(dc.card(_('Who is online · %d').format(online_devs.length), online_devs.length ? [ E('div', { 'class': 'dk-table-wrap' }, [ E('table', { 'class': 'dk-table' }, [ tb ]) ]) ] : [ E('div', { 'class': 'dk-empty' }, [ E('b', {}, _('No devices online')), E('span', { 'class': 'dk-dim' }, _('Connect a phone or laptop and it shows up here.')) ]) ], { link: [ _('All devices'), dc.luci('admin/deck/devices') ] }));

		const mem = st.info.memory, used = mem.total - (mem.available || mem.free);
		const ov = st.storage.overlay || {};
		const meters = [
			dc.meter(_('Load'), Math.min(100, st.info.load[0] / 65536 * 100), (st.info.load[0] / 65536).toFixed(2)),
			dc.meter(_('RAM'), used / mem.total * 100, `${dc.bytes(used)} / ${dc.bytes(mem.total)}`, 75)
		];
		if (ov.total) meters.push(dc.meter(ov.external ? _('USB') : _('Storage'), (ov.total - ov.free) / ov.total * 100, `${dc.bytes(ov.total - ov.free)} / ${dc.bytes(ov.total)}`, 85));
		if (st.temperature != null) meters.push(dc.meter(_('Temp'), st.temperature, st.temperature.toFixed(0) + ' °C', 75));
		row2.appendChild(dc.card(_('Router · %s').format(st.board.model || ''), meters.concat([ E('p', { 'class': 'dk-note' }, `${st.board.release.description} · ${_('up')} ${dc.dur(st.info.uptime)}`) ])));

		if ((evs || []).length) {
			const color = { deck: 'var(--dk-green)', net: 'var(--dk-blue)', vpn: 'var(--dk-amber)', system: 'var(--dk-dim)' };
			const tl = E('ol', { 'class': 'dk-timeline' });
			evs.slice(0, 7).forEach(e => { const li = E('li', {}, [ E('span', { 'class': 't' }, e.time), E('span', { 'class': 'x' }, e.text) ]); li.style.setProperty('--c', color[e.kind] || 'var(--dk-blue)'); tl.appendChild(li); });
			row2.appendChild(dc.card(_('Timeline'), [ tl ], { link: [ _('System log'), dc.luci('admin/status/logs') ] }));
		}
		children.push(row2);

		const t = E('span', {}, head[0]);
		if (head[1]) t.className = head[1];
		this.titleEl.replaceChildren(t);
		this.body.replaceChildren(...children);
	},

	toggle(on) {
		busyUntil = Date.now() + 8000;
		return dc.vpnSet(on).then(() => this.refresh());
	},

	restart() {
		busyUntil = Date.now() + 8000;
		return dc.vpnRestart().then(() => this.refresh());
	},

	refresh() {
		return Promise.all([ dc.status(), dc.devices(), dc.events(8) ]).then(r => this.renderAll(this.caps, r[0], r[1], r[2]));
	},

	render(data) {
		this.caps = data[0];
		const root = dc.page(_('Right now'), '', []);
		this.titleEl = root.querySelector('.dk-title');
		this.body = E('div', { style: 'display:flex;flex-direction:column;gap:14px' });
		root.appendChild(this.body);
		this.renderAll(data[0], data[1], data[2], data[3]);
		poll.add(() => this.refresh(), 5);
		return root;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
