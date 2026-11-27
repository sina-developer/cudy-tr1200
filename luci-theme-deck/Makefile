# SPDX-License-Identifier: Apache-2.0
#
# luci-theme-deck: the Deck look for every LuCI page.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Deck theme
LUCI_DESCRIPTION:=A condensed, instrument-panel style LuCI theme with a side \
	menu, dark and light modes, and a phone layout. Built on the Bootstrap \
	theme's stylesheet so every LuCI page and app keeps working.
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0 OFL-1.1
PKG_LICENSE_FILES:=htdocs/luci-static/deck/fonts/OFL-BarlowCondensed.txt htdocs/luci-static/deck/fonts/OFL-JetBrainsMono.txt
PKG_MAINTAINER:=[MAINTAINER NAME] <[maintainer@example.com]>

define Package/luci-theme-deck/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.Deck
	[ "$$(uci -q get luci.main.mediaurlbase)" = /luci-static/deck ] && uci set luci.main.mediaurlbase=/luci-static/bootstrap
	uci commit luci
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
