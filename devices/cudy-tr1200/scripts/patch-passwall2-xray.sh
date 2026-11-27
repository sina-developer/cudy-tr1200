#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Let Passwall2 run with Xray 26.2.x.
#
# Why: Xray 26.9 and newer refuse VLESS without TLS. If your servers use plain
# VLESS (and you cannot change them), you have to stay on Xray 26.2.x. Newer
# Passwall2 releases (a) refuse to start an Xray older than 26.9.9 and
# (b) write the newer config key "allowedNetwork", which Xray 26.2 does not
# know (it expects "network"). This script undoes both, in place.
#
# Run it again after every Passwall2 upgrade. A copy of the original file is
# kept as util_xray.lua.orig the first time.
#
# Usage: patch-passwall2-xray.sh [min_version]   (default 26.2.4)
set -e
F=${F:-/usr/lib/lua/luci/passwall2/util_xray.lua}
MIN=${1:-26.2.4}
[ -f "$F" ] || { echo "Passwall2 not found ($F)"; exit 1; }
[ -f "$F.orig" ] || cp "$F" "$F.orig"
sed -i \
	-e "s/^local xray_min_version = \"[0-9.]*\"/local xray_min_version = \"$MIN\"/" \
	-e 's/allowedNetwork = /network = /g' \
	-e 's/\.settings\.allowedNetwork/.settings.network/g' \
	"$F"
echo "patched: $(grep -c 'network = ' "$F") network keys, min version $(sed -n 's/^local xray_min_version = "\(.*\)"/\1/p' "$F")"
grep -q allowedNetwork "$F" && echo "warning: 'allowedNetwork' still appears in $F, check it by hand"
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null
echo "restart Passwall2: /etc/init.d/passwall2 restart"
