#!/bin/sh
# Copy the Deck packages' files straight onto a router for development.
# Usage: scripts/deploy-dev.sh [root@192.168.1.1] [ssh options...]
# Does not restart the network, Wi-Fi or any VPN app.
set -e
HOST=${1:-root@192.168.1.1}; shift || true
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
for pkg in luci-app-deck luci-theme-deck; do
	[ -d $pkg/root ] && cp -R $pkg/root/. "$TMP/"
	[ -d $pkg/htdocs ] && mkdir -p "$TMP/www" && cp -R $pkg/htdocs/. "$TMP/www/"
	[ -d $pkg/ucode ] && mkdir -p "$TMP/usr/share/ucode/luci" && cp -R $pkg/ucode/. "$TMP/usr/share/ucode/luci/"
done
# never overwrite an existing config on the router
CFG_KEEP=$(ssh "$@" "$HOST" 'test -f /etc/config/deck && echo keep || true')
[ "$CFG_KEEP" = keep ] && rm -f "$TMP/etc/config/deck"
chmod 0755 "$TMP"
# Pack only the top-level folders (never "."), owned by root, and extract
# without restoring owners, so nothing on the router changes owner or mode.
COPYFILE_DISABLE=1 tar -C "$TMP" --uid 0 --gid 0 -cf - $(cd "$TMP" && ls) | ssh "$@" "$HOST" 'tar -C / -o -xf - && chmod 0755 /usr/libexec/deck/* /etc/init.d/deck && for f in /etc/uci-defaults/80-luci-app-deck /etc/uci-defaults/30_luci-theme-deck; do [ -f $f ] && sh $f && rm -f $f; done; echo deployed'
rm -rf "$TMP"
