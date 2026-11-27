'use strict';
'require view';
'require poll';
'require deck.common as dc';

/* SPDX-License-Identifier: Apache-2.0
 * Deck network page: uplinks in priority order, Wi-Fi radios and networks,
 * shortcuts into the full LuCI pages for every setting. */

const BAND = { '2g': '2.4 GHz', '5g': '5 GHz', '6g': '6 GHz', '60g': '60 GHz' };
const ENC = { none: _('Open'), psk: 'WPA', psk2: 'WPA2', 'psk-mixed': 'WPA/WPA2', sae: 'WPA3', 'sae-mixed': 'WPA2/WPA3', owe: 'OWE' };

return view.extend({
	load() { return dc.status(); },

	draw(st) {
		const kids = [];
		const ups = (st.uplinks || []).slice().sort((a, b) => a.metric - b.metric);
		const active = ups.find(u => u.up);

		const list = E('ol', { 'class': 'dk-src' });
		ups.forEach((u, i) => {
			const on = active && u.name == active.name;
			const st_ = on ? [ _('In use'), u.wireless ? 'blue' : 'ok' ] : u.up ? [ _('Standby'), 'off' ] : [ u.wireless ? _('Not connected') : (u.carrier ? _('No address') : _('Unplugged')), 'off' ];
			const rows = [
				[ _('Interface'), `${u.name} · ${u.proto}` ], [ _('Device'), u.device || '—' ],
				[ _('Address'), u.ipv4 || '—' ], [ _('Gateway'), u.gateway || '—' ],
				[ _('Priority (metric)'), String(u.metric) ], [ _('Up for'), u.up ? dc.dur(u.uptime) : '—' ]
			];
			if (u.wireless) rows.splice(1, 0, [ _('Network'), u.ssid || '—' ], [ _('Signal'), u.signal != null ? u.signal + ' dBm' : '—' ]);
			list.appendChild(E('li', { 'class': (on ? 'active' : '') + (u.wireless ? ' wifi' : '') }, [
				E('div', { 'class': 'row' }, [ E('span', { 'class': 'name' }, `${i + 1} · ${u.wireless ? _('Wi-Fi uplink') : _('Cable')} (${u.name})`), dc.tag(st_[0], st_[1]) ]),
				u.wireless ? dc.bars(dc.signalBars(u.signal), u.up ? 'var(--dk-blue)' : null) : '',
				E('table', { 'class': 'dk-table' }, [ E('tbody', {}, rows.map(r => E('tr', {}, [ E('td', { 'class': 'dk-dim', style: 'width:40%' }, r[0]), E('td', { 'class': 'dk-mono', style: 'font-size:13px' }, r[1]) ]))) ]),
				E('div', {}, [ E('a', { 'class': 'dk-btn', href: dc.luci('admin/network/network') }, _('Edit in Interfaces')) ])
			]));
		});
		kids.push(dc.card(_('Where internet comes from'), ups.length ? [ list,
			E('p', { 'class': 'dk-note' }, _('The router uses the working uplink with the lowest metric. Change metrics under Interfaces › Advanced settings.')) ]
			: [ E('div', { 'class': 'dk-empty' }, [ E('b', {}, _('No internet source configured')), E('span', { 'class': 'dk-dim' }, _('Plug a cable into the WAN port, or join another Wi-Fi network as a client.')) ]) ]));

		const radios = E('div', { 'class': 'dk-grid' });
		(st.wifi || []).forEach(r => {
			const ifs = r.interfaces.map(i => E('tr', { 'class': i.disabled ? 'off' : '' }, [
				E('td', {}, [ E('span', { 'class': 'n' }, i.ssid || '—'), E('span', { 'class': 'm' }, `${i.mode == 'ap' ? _('Access point') : i.mode == 'sta' ? _('Client (uplink)') : i.mode} · ${ENC[i.encryption] || i.encryption}${i.ifname ? ' · ' + i.ifname : ''}`) ]),
				E('td', { style: 'text-align:right' }, i.disabled ? dc.tag(_('Off'), 'off') : i.mode == 'ap' ? dc.tag(_('%d clients').format(i.clients || 0), 'ok') : i.signal != null ? dc.tag(i.signal + ' dBm', 'blue') : dc.tag(_('On'), 'ok'))
			]));
			radios.appendChild(dc.card(`${r.radio} · ${BAND[r.band] || r.band || ''}`, [
				E('div', { 'class': 'dk-mono dk-dim', style: 'font-size:13px' }, `${_('channel')} ${r.channel || 'auto'} · ${r.htmode || ''} · ${r.disabled ? _('radio off') : r.up ? _('radio on') : _('radio down')}`),
				E('div', { 'class': 'dk-table-wrap' }, [ E('table', { 'class': 'dk-table' }, [ E('tbody', {}, ifs) ]) ]),
				r.band == '2g' && (st.wifi || []).length == 1 ? '' : ''
			], { link: [ _('Edit in Wireless'), dc.luci('admin/network/wireless') ] }));
		});
		if ((st.wifi || []).length) kids.push(radios);
		else kids.push(dc.card(_('Wi-Fi'), [ E('div', { 'class': 'dk-empty' }, [ E('b', {}, _('This router has no Wi-Fi radio')), E('span', { 'class': 'dk-dim' }, _('Wired-only devices skip this section.')) ]) ]));

		const links = [ [ _('Interfaces'), 'admin/network/network' ], [ _('Wireless'), 'admin/network/wireless' ], [ _('DHCP'), 'admin/network/dhcp' ], [ _('DNS'), 'admin/network/dns' ],
			[ _('Firewall'), 'admin/network/firewall' ], [ _('Routing'), 'admin/network/routes' ], [ _('Diagnostics'), 'admin/network/diagnostics' ] ];
		kids.push(dc.card(_('All network settings'), [ E('div', { 'class': 'dk-btn-row' }, links.map(l => E('a', { 'class': 'dk-btn', href: dc.luci(l[1]) }, l[0]))) ]));
		return kids;
	},

	refresh() { return dc.status().then(st => this.body.replaceChildren(...this.draw(st))); },

	render(st) {
		const root = dc.page(_('Dashboard › Network'), _('Internet & Wi-Fi'), []);
		this.body = E('div', { style: 'display:flex;flex-direction:column;gap:14px' }, this.draw(st));
		root.appendChild(this.body);
		poll.add(() => this.refresh(), 10);
		return root;
	},

	handleSave: null, handleSaveApply: null, handleReset: null
});
