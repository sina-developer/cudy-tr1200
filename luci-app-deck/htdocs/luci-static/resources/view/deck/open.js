'use strict';
'require view';

/* SPDX-License-Identifier: Apache-2.0
 * LuCI menu entry that opens the standalone Deck dashboard at /deck/. */
return view.extend({
	render() {
		window.location.href = '/deck/';
		return E('p', {}, [ _('Opening the dashboard… '), E('a', { href: '/deck/' }, _('Open Deck')) ]);
	},
	handleSave: null, handleSaveApply: null, handleReset: null
});
