'use strict';
'require view';
'require poll';
'require ui';
'require deck.common as dc';

/* SPDX-License-Identifier: Apache-2.0
 * Deck VPN page: on/off, active node, node list. Credentials are never shown:
 * the backend only returns names, protocol and transport. */

let busyUntil = 0;

return view.extend({
	load() {
		return Promise.all([ dc.status(), dc.nodes() ]);
	},

	draw(st, nl) {
		const vpn = st.vpn;
		const kids = [];
		if (!vpn) {
			kids.push(E('div', { 'class': 'dk-empty' }, [ E('b', {}, _('No VPN app found')), E('span', { 'class': 'dk-dim' }, _('Install a supported VPN app (PassWall 2 today) and this page fills in.')) ]));
			return kids;
		}

		const busy = vpn.state == 'switching' || Date.now() < busyUntil;
		const color = { on: 'var(--dk-green)', switching: 'var(--dk-amber)', failed: 'var(--dk-red)' }[vpn.state] || 'var(--dk-green)';
		const sw = E('button', { 'class': 'dk-switch', role: 'switch', 'aria-checked': vpn.enabled ? 'true' : 'false', 'aria-label': _('VPN'), click: () => this.set(!vpn.enabled) }, [
			E('span', { 'class': 'knob' }), E('span', { 'class': 'lbl off' }, _('OFF')),
			E('span', { 'class': 'lbl on' }, [ E('span', { 'class': busy ? 'blink' : '' }, vpn.state == 'switching' ? _('WAIT') : vpn.state == 'failed' ? _('FAILED') : _('VPN')) ])
		]);
		sw.style.setProperty('--c', color);
		if (busy) sw.disabled = true;

		const state = { on: [ _('Running'), 'ok' ], switching: [ _('Switching'), 'warn' ], failed: [ _('Core not running'), 'bad' ], off: [ _('Off'), 'off' ] }[vpn.state];
		kids.push(E('div', { 'class': 'dk-grid' }, [
			dc.card(_('VPN switch'), [ sw,
				E('div', { 'class': 'dk-btn-row' }, [ dc.btn(_('Restart VPN'), 'line', () => this.restart(), busy ? { disabled: '' } : {}),
					E('a', { 'class': 'dk-btn', href: dc.luci(vpn.luci) }, _('All %s settings').format(vpn.app)) ]) ]),
			dc.card(_('Status'), [
				E('div', { 'class': 'dk-hw-row' }, [ dc.tag(state[0], state[1]) ]),
				E('table', { 'class': 'dk-table' }, [ E('tbody', {}, [
					E('tr', {}, [ E('td', { 'class': 'dk-dim' }, _('App')), E('td', { 'class': 'dk-mono' }, vpn.app) ]),
					E('tr', {}, [ E('td', { 'class': 'dk-dim' }, _('Core')), E('td', { 'class': 'dk-mono' }, vpn.core || '—') ]),
					E('tr', {}, [ E('td', { 'class': 'dk-dim' }, _('Active node')), E('td', { 'class': 'dk-mono' }, vpn.node ? vpn.node.name : '—') ]),
					E('tr', {}, [ E('td', { 'class': 'dk-dim' }, _('Routing')), E('td', { 'class': 'dk-mono' }, vpn.shunt ? _('rule-based (shunt)') : _('everything through the node')) ])
				]) ])
			])
		]));

		const nodes = (nl.nodes || []).filter(n => n.complete && !n.shunt);
		const list = E('div', { role: 'radiogroup', 'aria-label': _('Active node'), style: 'display:flex;flex-direction:column;gap:6px' });
		nodes.forEach(n => {
			const on = vpn.node && vpn.node.id == n.id;
			list.appendChild(E('button', { 'class': 'dk-radio', role: 'radio', 'aria-checked': on ? 'true' : 'false', click: () => on ? null : this.select(n) }, [
				E('span', { 'class': 'dot', 'aria-hidden': 'true' }),
				E('span', { 'class': 'nm' }, n.name),
				E('span', { style: 'display:flex;gap:8px;align-items:center' }, [
					E('span', { 'class': 'dk-mono', style: 'font-size:12px' }, `${(n.protocol || n.type || '').toUpperCase()}${n.transport ? ' · ' + n.transport : ''}`),
					n.tls ? dc.tag(_('TLS'), 'ok') : dc.tag(_('No TLS'), 'warn')
				])
			]));
		});
		const ckids = [ nodes.length ? list : E('div', { 'class': 'dk-empty' }, [ E('b', {}, _('No nodes yet')), E('span', { 'class': 'dk-dim' }, _('Add a node link or a subscription in the app settings.')) ]) ];
		if (nodes.some(n => !n.tls))
			ckids.push(E('div', { 'class': 'dk-banner warn', style: 'font-size:16px' }, _('Nodes marked “No TLS” send traffic between the router and the server unencrypted. Ask your provider for a TLS or REALITY link when you can.')));
		ckids.push(E('p', { 'class': 'dk-note' }, _('Server addresses and keys are never shown here.')));
		kids.push(dc.card(_('Nodes · %d').format(nodes.length), ckids, { link: [ _('Add or edit nodes'), dc.luci(vpn.luci) ] }));
		return kids;
	},

	set(on) { busyUntil = Date.now() + 8000; return dc.vpnSet(on).then(() => this.refresh()); },
	restart() { busyUntil = Date.now() + 8000; return dc.vpnRestart().then(() => this.refresh()); },
	select(n) {
		dc.confirm(_('Switch node?'), _('The VPN restarts on “%s”. Connections drop for a few seconds.').format(n.name), _('Switch'), 'apply', () => {
			busyUntil = Date.now() + 8000;
			dc.vpnSelect(n.id).then(() => this.refresh());
		});
	},

	refresh() { return Promise.all([ dc.status(), dc.nodes() ]).then(r => this.body.replaceChildren(...this.draw(r[0], r[1]))); },

	render(data) {
		const root = dc.page(_('Dashboard › VPN'), _('VPN'), []);
		this.body = E('div', { style: 'display:flex;flex-direction:column;gap:14px' }, this.draw(data[0], data[1]));
		root.appendChild(this.body);
		poll.add(() => this.refresh(), 5);
		return root;
	},

	handleSave: null, handleSaveApply: null, handleReset: null
});
