'use strict';
'require view';
'require poll';
'require deck.common as dc';

/* SPDX-License-Identifier: Apache-2.0
 * Deck devices page: everything the router knows about from DHCP leases,
 * the neighbour table and Wi-Fi association lists. */

let filter = 'online';

return view.extend({
	load() { return dc.devices(); },

	draw(devs) {
		devs = (devs || []).slice().sort((a, b) => (b.online - a.online) || String(a.name || '~').localeCompare(String(b.name || '~')));
		const counts = { all: devs.length, online: devs.filter(d => d.online).length, wifi: devs.filter(d => (d.via || '').indexOf('wifi:') == 0).length, cable: devs.filter(d => d.via == 'cable').length };
		const chips = E('div', { role: 'group', 'aria-label': _('Filter devices'), style: 'display:flex;gap:6px;flex-wrap:wrap' },
			[ [ 'online', _('Online') ], [ 'wifi', _('Wi-Fi') ], [ 'cable', _('Cable') ], [ 'all', _('All') ] ].map(f => E('button', {
				'class': 'dk-btn' + (filter == f[0] ? ' dk-btn-ink' : ''), 'aria-pressed': filter == f[0] ? 'true' : 'false',
				click: () => { filter = f[0]; this.body.replaceChildren(...this.draw(this.last)); } }, `${f[1]} ${counts[f[0]]}`)));

		const shown = devs.filter(d => filter == 'all' || (filter == 'online' && d.online) || (filter == 'wifi' && (d.via || '').indexOf('wifi:') == 0) || (filter == 'cable' && d.via == 'cable'));
		const tb = E('tbody', {}, shown.map(d => E('tr', { 'class': d.online ? '' : 'off' }, [
			E('td', {}, [ E('span', { 'class': 'n' }, d.name || _('Unknown device')), E('span', { 'class': 'm' }, `${d.mac}`) ]),
			E('td', { 'class': 'dk-mono', style: 'font-size:13px' }, d.ip || '—'),
			E('td', {}, d.via && d.via.indexOf('wifi:') == 0 ? [ dc.bars(dc.signalBars(d.signal), 'var(--dk-blue)'), ' ', E('span', { 'class': 'dk-mono', style: 'font-size:12px' }, `${d.via.slice(5)} · ${d.signal} dBm`) ] : E('span', { 'class': 'dk-mono', style: 'font-size:12px' }, d.via == 'cable' ? _('cable') : '—')),
			E('td', { 'class': 'dk-mono', style: 'font-size:12px' }, d.rx_rate ? `${d.rx_rate} / ${d.tx_rate} Mbit/s` : '—'),
			E('td', { style: 'text-align:right' }, d.online ? dc.tag(_('Online'), 'ok') : dc.tag(_('Offline'), 'off'))
		])));
		const table = shown.length ? E('div', { 'class': 'dk-table-wrap' }, [ E('table', { 'class': 'dk-table', style: 'min-width:640px' }, [
			E('thead', {}, E('tr', {}, [ _('Device'), _('IP address'), _('Connected'), _('Link rate'), '' ].map(h => E('th', {}, h)))), tb ]) ])
			: E('div', { 'class': 'dk-empty' }, [ E('b', {}, _('No devices here')), E('span', { 'class': 'dk-dim' }, _('Connect a phone or laptop and it shows up within a few seconds.')) ]);

		return [ chips, dc.card(_('Devices'), [ table,
			E('p', { 'class': 'dk-note' }, _('Names come from DHCP and static leases. To give a device a fixed address or name, add it under DHCP › Static leases.')),
			E('div', {}, [ E('a', { 'class': 'dk-btn', href: dc.luci('admin/network/dhcp') }, _('Static leases')) ]) ]) ];
	},

	refresh() { return dc.devices().then(d => { this.last = d; this.body.replaceChildren(...this.draw(d)); }); },

	render(devs) {
		this.last = devs;
		const root = dc.page(_('Dashboard › Devices'), _('Devices'), []);
		this.body = E('div', { style: 'display:flex;flex-direction:column;gap:14px' }, this.draw(devs));
		root.appendChild(this.body);
		poll.add(() => this.refresh(), 10);
		return root;
	},

	handleSave: null, handleSaveApply: null, handleReset: null
});
