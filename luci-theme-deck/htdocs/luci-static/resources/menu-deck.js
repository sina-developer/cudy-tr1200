'use strict';
'require baseclass';
'require ui';

/* SPDX-License-Identifier: Apache-2.0
 * luci-theme-deck menu: renders LuCI's menu tree as a side rail with groups,
 * plus the per-page tab bar. Based on menu-bootstrap.js (Copyright Jo-Philipp Wich). */

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));
		this.bindChrome();
	},

	bindChrome() {
		const tgl = document.querySelector('.deck-menu-toggle');
		const rail = document.querySelector('#deck-rail');
		if (tgl && rail)
			tgl.addEventListener('click', () => {
				const open = rail.classList.toggle('open');
				tgl.setAttribute('aria-expanded', open ? 'true' : 'false');
			});
		const th = document.querySelector('.deck-theme-toggle');
		if (th)
			th.addEventListener('click', () => {
				const root = document.querySelector(':root');
				const dark = root.getAttribute('data-darkmode') !== 'true';
				root.setAttribute('data-darkmode', String(dark));
				try { localStorage.setItem('deck-theme', dark ? 'dark' : 'light'); } catch (e) {}
			});
	},

	render(tree) {
		let node = tree, url = '';
		this.renderModeMenu(tree);
		if (L.env.dispatchpath.length >= 3) {
			for (let i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}
			if (node) this.renderTabMenu(node, url);
		}
	},

	isActive(path) {
		const req = L.env.dispatchpath || [];
		const parts = path.split('/');
		for (let i = 0; i < parts.length; i++)
			if (req[i] !== parts[i]) return false;
		return true;
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const ul = E('ul', { 'class': 'tabs' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;
		children.forEach((child) => {
			const isActive = (L.env.dispatchpath[3 + (level || 0)] == child.name);
			ul.appendChild(E('li', { 'class': 'tabmenu-item-%s %s'.format(child.name, isActive ? 'active' : '') }, [
				E('a', { 'href': L.url(url, child.name), 'aria-current': isActive ? 'page' : null }, [ _(child.title) ])
			]));
			if (isActive) activeNode = child;
		});
		if (ul.children.length == 0) return E([]);
		container.appendChild(ul);
		container.style.display = '';
		if (activeNode) this.renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);
		return ul;
	},

	renderMainMenu(tree, url) {
		const ul = document.querySelector('#topmenu');
		ui.menu.getChildren(tree).forEach((group) => {
			const gpath = url + '/' + group.name;
			const kids = ui.menu.getChildren(group);
			if (!kids.length) {
				ul.appendChild(E('li', { 'class': 'deck-leaf' + (this.isActive(gpath) ? ' active' : '') }, [
					E('a', { 'href': L.url(url, group.name), 'aria-current': this.isActive(gpath) ? 'page' : null }, [ _(group.title) ])
				]));
				return;
			}
			const open = this.isActive(gpath);
			const sub = E('ul', { 'class': 'deck-sub' });
			kids.forEach((child) => {
				const cpath = gpath + '/' + child.name;
				const on = this.isActive(cpath);
				sub.appendChild(E('li', { 'class': on ? 'active' : '' }, [
					E('a', { 'href': L.url(url, group.name, child.name), 'aria-current': on ? 'page' : null }, [ _(child.title) ])
				]));
			});
			const head = E('button', { 'type': 'button', 'class': 'deck-group-head', 'aria-expanded': open ? 'true' : 'false' }, [ _(group.title) ]);
			const li = E('li', { 'class': 'deck-group' + (open ? ' open' : '') }, [ head, sub ]);
			head.addEventListener('click', () => {
				const o = li.classList.toggle('open');
				head.setAttribute('aria-expanded', o ? 'true' : 'false');
			});
			ul.appendChild(li);
		});
		ul.style.display = '';
	},

	renderModeMenu(tree) {
		const ul = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);
		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length ? child.name === L.env.requestpath[0] : index === 0;
			ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [ E('a', { 'href': L.url(child.name) }, [ _(child.title) ]) ]));
			if (isActive) this.renderMainMenu(child, child.name);
		});
		if (ul.children.length > 1) ul.style.display = '';
	}
});
