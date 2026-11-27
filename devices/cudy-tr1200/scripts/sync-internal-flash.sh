#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copy the important settings from the USB overlay (extroot) to the internal
# flash overlay (/rwm), so the router still comes up with the same LAN address,
# Wi-Fi and uplinks if it boots without the USB stick.
#
# Only small config files are copied: packages installed on the stick (Passwall2,
# Xray, Deck, ...) do not fit in the internal flash and are not copied.
# Existing files on /rwm are kept as <name>.pre-sync the first time.
#
# Run it again whenever you change network, Wi-Fi, firewall or system settings.
set -e
grep -q ' /rwm ' /proc/mounts || { echo "/rwm is not mounted (extroot not active?)"; exit 1; }
DST=/rwm/upper/etc/config
mkdir -p "$DST"
for f in network wireless firewall system dhcp dropbear uhttpd; do
	[ -f "/etc/config/$f" ] || continue
	[ -f "$DST/$f" ] && [ ! -f "$DST/$f.pre-sync" ] && cp "$DST/$f" "$DST/$f.pre-sync"
	cp "/etc/config/$f" "$DST/$f"
	echo "copied $f"
done
# root password and SSH keys, so you can still log in
mkdir -p /rwm/upper/etc/dropbear
[ -f /etc/dropbear/authorized_keys ] && cp /etc/dropbear/authorized_keys /rwm/upper/etc/dropbear/
cp /etc/shadow /rwm/upper/etc/shadow && chmod 600 /rwm/upper/etc/shadow
sync
echo "done"
