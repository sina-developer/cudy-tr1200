# SPDX-License-Identifier: Apache-2.0
#
# luci-app-deck: a simple, capability-aware dashboard for OpenWrt.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Deck dashboard for OpenWrt
LUCI_DESCRIPTION:=A simple dashboard that shows only what your router can do: \
	VPN switch (PassWall 2), traffic path, internet uplinks with backup, Wi-Fi, \
	devices, storage, and optional LED status and hardware VPN button.
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +iw
LUCI_PKGARCH:=all

PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=[MAINTAINER NAME] <[maintainer@example.com]>

define Package/luci-app-deck/conffiles
/etc/config/deck
endef

define Package/luci-app-deck/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/deck stop 2>/dev/null
	/etc/init.d/deck disable 2>/dev/null
	for f in /etc/rc.button/*; do
		[ -L "$$f" ] && [ "$$(readlink "$$f")" = /usr/libexec/deck/button ] && rm -f "$$f"
	done
}
exit 0
endef

# Use the LuCI build rules from the luci feed.
include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
