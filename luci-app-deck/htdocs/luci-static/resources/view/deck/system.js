'use strict';
'require view';
'require form';
'require ui';
'require deck.common as dc';

/* SPDX-License-Identifier: Apache-2.0
 * Deck system page: what was found on this router, storage, and the Deck
 * settings (LED status, VPN button, internet checks). Sections for hardware
 * the router does not have are not shown. */

const YES = 'M5 12l5 5L20 7', NO = 'M6 6l12 12M18 6 6 18';

function capRow(name, sub, ok) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('aria-hidden', 'true');
	const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	p.setAttribute('d', ok ? YES : NO); p.setAttribute('fill', 'none'); p.setAttribute('stroke', ok ? 'var(--dk-green)' : 'var(--dk-dim)'); p.setAttribute('stroke-width', '2.4'); p.setAttribute('stroke-linecap', 'round');
	svg.appendChild(p);
	return E('li', { 'class': ok ? '' : 'no' }, [ svg, E('span', {}, [ E('span', { 'class': 'nm' }, name), E('span', { 'class': 'dk-mono dk-dim', style: 'font-size:12px' }, sub) ]) ]);
}

return view.extend({
	load() { return Promise.all([ dc.caps(), dc.status() ]); },

	render(data) {
		const caps = data[0], st = data[1];
		const leds = caps.leds || [], buttons = caps.buttons || [];
		const kids = [];

		/* what was found */
		const ul = E('ul', { 'class': 'dk-caps' }, [
			capRow(_('VPN app'), caps.vpn ? caps.vpn.app : _('none installed'), !!caps.vpn),
			capRow(_('Status LEDs'), leds.length ? leds.map(l => l.name).join(', ') : _('none usable'), leds.length > 0),
			capRow(_('Buttons & switches'), buttons.length ? buttons.map(b => `${b.label}${b.switch ? ' (switch)' : ''}`).join(', ') : _('none found'), buttons.length > 0),
			capRow(_('Wi-Fi radios'), String(caps.radios || 0), (caps.radios || 0) > 0),
			capRow(_('Internet uplinks'), (caps.uplinks || []).join(', ') || _('none'), (caps.uplinks || []).length > 0),
			capRow(_('Backup internet'), (caps.uplinks || []).length > 1 ? _('%d uplinks, lowest metric wins').format(caps.uplinks.length) : _('single uplink'), (caps.uplinks || []).length > 1),
			capRow(_('External storage'), caps.external_storage ? _('apps and settings on USB') : _('built-in flash only'), !!caps.external_storage),
			capRow(_('Temperature sensor'), caps.temperature ? _('available') : _('not on this hardware'), !!caps.temperature)
		]);
		kids.push(dc.card(_('Found on this router'), [ ul, E('p', { 'class': 'dk-note' }, _('Sections for missing features are hidden. Nothing here is specific to one router model.')) ]));

		/* storage */
		const s = st.storage, meters = [];
		if (s.overlay && s.overlay.total) meters.push(dc.meter(s.overlay.external ? _('USB') : _('Storage'), (s.overlay.total - s.overlay.free) / s.overlay.total * 100, `${dc.bytes(s.overlay.total - s.overlay.free)} / ${dc.bytes(s.overlay.total)}`, 85));
		if (s.builtin && s.builtin.total) meters.push(dc.meter(_('Built-in'), (s.builtin.total - s.builtin.free) / s.builtin.total * 100, `${dc.bytes(s.builtin.total - s.builtin.free)} / ${dc.bytes(s.builtin.total)}`, 85));
		if (s.tmp && s.tmp.total) meters.push(dc.meter(_('RAM disk'), (s.tmp.total - s.tmp.free) / s.tmp.total * 100, `${dc.bytes(s.tmp.total - s.tmp.free)} / ${dc.bytes(s.tmp.total)}`, 85));
		const storageNote = s.overlay && s.overlay.external ? _('Apps and settings live on the USB stick (%s). Keep it plugged in.').format(s.overlay.device) : _('Apps and settings live in the built-in flash.');
		kids.push(dc.card(_('Storage'), meters.concat([ E('p', { 'class': 'dk-note' }, storageNote) ]), { link: [ _('Mount points'), dc.luci('admin/system/mounts') ] }));

		/* settings form */
		const m = new form.Map('deck', _('Dashboard settings'), _('Saved with Save & Apply. The router undoes risky changes by itself if it loses contact.'));
		let sec, o;

		sec = m.section(form.NamedSection, 'monitor', 'monitor', _('Internet checks'));
		o = sec.option(form.Flag, 'enabled', _('Check the internet'), _('Needed for the “No internet” status and the LED.'));
		o.default = '1';
		o = sec.option(form.Value, 'interval', _('Check every (seconds)'));
		o.datatype = 'range(5,600)'; o.placeholder = '15'; o.depends('enabled', '1');
		o = sec.option(form.Value, 'fails', _('Failed checks before “down”'));
		o.datatype = 'range(1,20)'; o.placeholder = '2'; o.depends('enabled', '1');
		o = sec.option(form.DynamicList, 'url', _('Check addresses'), _('Plain http addresses that answer with 204. The first one that works counts.'));
		o.depends('enabled', '1');

		const usable = leds.filter(l => !l.system);
		if (usable.length) {
			sec = m.section(form.NamedSection, 'led', 'led', _('Status on the router’s LED'),
				_('Solid = VPN on (or online without a VPN app). Fast blink = switching. Short blip = VPN off. Alert LED blinking = VPN core failed, solid = no internet.'));
			o = sec.option(form.Flag, 'enabled', _('Show status on the LEDs'));
			o = sec.option(form.ListValue, 'ok_led', _('LED for “all good”'));
			o.value('', _('— none —'));
			usable.forEach(l => o.value(l.name, l.name));
			o.depends('enabled', '1');
			o = sec.option(form.ListValue, 'alert_led', _('LED for problems'));
			o.value('', _('— same as “all good” —'));
			usable.forEach(l => o.value(l.name, l.name));
			o.depends('enabled', '1');
			o = sec.option(form.Value, 'off_blip', _('Blip interval when VPN is off (ms)'));
			o.datatype = 'range(1000,60000)'; o.placeholder = '5000'; o.depends('enabled', '1');
		}

		if (caps.vpn && buttons.length) {
			sec = m.section(form.NamedSection, 'vpn_button', 'button', _('VPN switch on the router'),
				_('Use a hardware button or slider to turn the VPN on and off. Buttons that already have their own script are left alone.'));
			o = sec.option(form.ListValue, 'name', _('Button'));
			o.value('', _('— not used —'));
			buttons.filter(b => b.name != 'reset').forEach(b => o.value(b.name, `${b.label} (${b.name}${b.switch ? ', switch' : ''}) · now ${b.state || '?'}${b.handler && b.handler.indexOf('/usr/libexec/deck') < 0 ? ' · has its own script' : ''}`));
			o = sec.option(form.ListValue, 'on_event', _('VPN is on when the button is'));
			o.value('pressed', _('pressed (switch on that side)'));
			o.value('released', _('released'));
			o.depends({ name: /./ });
		}

		/* actions */
		const links = [ [ _('Backup / Flash'), 'admin/system/flash' ], [ _('Software'), 'admin/system/package-manager' ], [ _('Router password'), 'admin/system/admin' ],
			[ _('System log'), 'admin/status/logs' ], [ _('LED configuration'), 'admin/system/leds' ], [ _('Startup'), 'admin/system/startup' ] ];
		kids.push(dc.card(_('More system settings'), [ E('div', { 'class': 'dk-btn-row' }, links.map(l => E('a', { 'class': 'dk-btn', href: dc.luci(l[1]) }, l[0]))),
			E('div', { 'class': 'dk-btn-row' }, [ dc.btn(_('Restart router…'), 'red', () => dc.confirm(_('Restart the router?'), _('Everyone loses internet for about two minutes. Settings are kept.'), _('Restart'), 'negative', () => dc.reboot().then(() => ui.awaitReconnect()))) ]) ]));

		kids.push(dc.card(_('About'), [ E('p', { 'class': 'dk-sub' }, _('Deck %s · a simple dashboard for OpenWrt routers. Free and open source under the Apache-2.0 licence.').format(dc.VERSION)),
			E('p', { 'class': 'dk-note' }, `${st.board.model} · ${st.board.release.description} · ${st.board.system}`) ]));

		const root = dc.page(_('Dashboard › System'), _('System'), kids.slice(0, 2));
		return m.render().then(node => {
			const wrap = E('div', { 'class': 'dk-card dk-form' }, [ node ]);
			root.appendChild(wrap);
			kids.slice(2).forEach(k => root.appendChild(k));
			return root;
		});
	}
});
