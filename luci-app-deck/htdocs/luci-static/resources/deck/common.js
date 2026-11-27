'use strict';
'require baseclass';
'require rpc';
'require ui';

/* SPDX-License-Identifier: Apache-2.0
 * Shared helpers for the Deck dashboard views. */

const callCaps    = rpc.declare({ object: 'deck', method: 'capabilities' });
const callStatus  = rpc.declare({ object: 'deck', method: 'status' });
const callDevices = rpc.declare({ object: 'deck', method: 'devices', expect: { devices: [] } });
const callEvents  = rpc.declare({ object: 'deck', method: 'events', params: [ 'limit' ], expect: { events: [] } });
const callNodes   = rpc.declare({ object: 'deck', method: 'vpn_nodes' });
const callVpnSet  = rpc.declare({ object: 'deck', method: 'vpn_set', params: [ 'enabled' ] });
const callVpnRestart = rpc.declare({ object: 'deck', method: 'vpn_restart' });
const callVpnSelect  = rpc.declare({ object: 'deck', method: 'vpn_select', params: [ 'node' ] });
const callReboot  = rpc.declare({ object: 'system', method: 'reboot' });

let cssLoaded = false;

return baseclass.extend({
	VERSION: '0.1.0',

	caps: callCaps, status: callStatus, devices: callDevices, events: callEvents,
	nodes: callNodes, vpnSet: callVpnSet, vpnRestart: callVpnRestart, vpnSelect: callVpnSelect,
	reboot: callReboot,

	css() {
		if (cssLoaded) return;
		cssLoaded = true;
		document.head.appendChild(E('link', { rel: 'stylesheet', href: L.resource('deck/deck.css') + '?v=' + this.VERSION }));
	},

	/* page shell: the Deck root plus a heading */
	page(kicker, title, children) {
		this.css();
		return E('div', { 'class': 'dk' }, [
			E('div', { 'class': 'dk-head' }, [
				E('div', {}, [ E('div', { 'class': 'dk-kicker' }, kicker), E('h1', { 'class': 'dk-title' }, title) ])
			])
		].concat(children));
	},

	card(title, children, opts) {
		opts = opts || {};
		const head = E('div', { 'class': 'dk-card-head' }, [ E('h2', { 'class': 'dk-h2' }, title) ]);
		if (opts.link) head.appendChild(E('a', { 'class': 'dk-more', href: opts.link[1] }, opts.link[0]));
		return E('section', { 'class': 'dk-card' + (opts.cls ? ' ' + opts.cls : '') }, [ head ].concat(children));
	},

	tag(text, kind) { return E('span', { 'class': 'dk-tag dk-tag-' + (kind || 'off') }, text); },

	btn(label, kind, fn, attrs) {
		return E('button', Object.assign({ 'class': 'dk-btn dk-btn-' + (kind || 'line'), click: fn }, attrs || {}), label);
	},

	luci(path) { return L.url.apply(L, path.split('/')); },

	bytes(n) {
		if (n == null) return '—';
		const u = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
		let i = 0;
		while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
		return (i ? n.toFixed(n < 10 ? 2 : 1) : n) + ' ' + u[i];
	},

	rate(bps) {
		if (bps == null) return [ '—', '' ];
		const m = bps * 8 / 1e6;
		return m >= 1 ? [ m.toFixed(1), 'Mbit/s' ] : [ (bps * 8 / 1e3).toFixed(0), 'kbit/s' ];
	},

	dur(s) {
		s = Math.max(0, Math.floor(s || 0));
		const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
		return d ? `${d} d ${h} h` : h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`;
	},

	signalBars(dbm) {
		if (dbm == null) return 0;
		return dbm >= -55 ? 4 : dbm >= -65 ? 3 : dbm >= -75 ? 2 : dbm >= -85 ? 1 : 0;
	},

	bars(n, color) {
		const el = E('span', { 'class': 'dk-bars', 'aria-hidden': 'true' });
		for (let i = 1; i <= 4; i++)
			el.appendChild(E('span', { style: `height:${i * 4 + 2}px;background:${i <= n ? (color || 'var(--dk-ink)') : 'var(--dk-off)'}` }));
		return el;
	},

	spark(values, color) {
		const w = 200, h = 40;
		const max = Math.max.apply(null, values.concat([ 1e-9 ])) * 1.15;
		const pts = values.map((v, i) => `${(i * w / Math.max(1, values.length - 1)).toFixed(1)},${(h - v / max * h).toFixed(1)}`).join(' ');
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
		svg.setAttribute('preserveAspectRatio', 'none');
		svg.setAttribute('class', 'dk-spark');
		svg.setAttribute('aria-hidden', 'true');
		const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		pl.setAttribute('points', pts);
		pl.setAttribute('fill', 'none');
		pl.setAttribute('stroke', color);
		pl.setAttribute('stroke-width', '2');
		pl.setAttribute('vector-effect', 'non-scaling-stroke');
		svg.appendChild(pl);
		return svg;
	},

	meter(name, pct, value, warn) {
		const fill = E('span', { 'class': 'dk-meter-fill' + (warn && pct >= warn ? ' dk-warn' : ''), style: `width:${Math.min(100, Math.max(0, pct)).toFixed(0)}%` });
		return E('div', { 'class': 'dk-meter' }, [
			E('span', { 'class': 'dk-meter-name' }, name),
			E('span', { 'class': 'dk-meter-track', 'aria-hidden': 'true' }, [ fill ]),
			E('span', { 'class': 'dk-mono dk-meter-val' }, value)
		]);
	},

	confirm(title, text, okLabel, okKind, fn) {
		ui.showModal(title, [
			E('p', {}, text),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', click: ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-' + (okKind || 'action') + ' important', click: () => { ui.hideModal(); fn(); } }, okLabel)
			])
		]);
	},

	/* VPN state helpers shared by views */
	vpnHead(vpn, online) {
		if (online === false) return [ _('No internet right now.'), 'bad' ];
		if (!vpn) return [ _('Online. Devices go direct.'), '' ];
		switch (vpn.state) {
		case 'on': return [ _('Protected.'), '' ];
		case 'switching': return [ _('VPN is switching…'), 'warn' ];
		case 'failed': return [ _('VPN failed. Tunnel is down.'), 'bad' ];
		default: return [ _('VPN off. Going direct.'), '' ];
		}
	}
});
