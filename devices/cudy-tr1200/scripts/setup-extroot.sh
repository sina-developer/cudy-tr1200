#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Move /overlay to a USB stick (OpenWrt "extroot").
# Follows https://openwrt.org/docs/guide-user/additional-software/extroot_configuration
#
# DESTROYS everything on the given partition. Usage:
#   setup-extroot.sh /dev/sda1 --format
# Then reboot. Check with: df -h /overlay   (should show the USB size)
set -e
DEV=$1
[ -b "$DEV" ] && [ "$2" = "--format" ] || { echo "usage: $0 /dev/sdXN --format   (erases the partition)"; exit 1; }

# Packages needed to see and mount the stick at boot
if command -v apk >/dev/null; then
	apk update && apk add block-mount kmod-usb-storage kmod-fs-ext4 e2fsprogs
else
	opkg update && opkg install block-mount kmod-usb-storage kmod-fs-ext4 e2fsprogs
fi

mkfs.ext4 -F -L extroot "$DEV"
eval $(block info "$DEV" | grep -o -e 'UUID="\S*"')
[ -n "$UUID" ] || { echo "no UUID for $DEV"; exit 1; }

# Keep the internal overlay reachable at /rwm
ORIG=$(block info | sed -n -e '/MOUNT="\S*\/overlay"/s/:\s.*$//p')
uci -q delete fstab.rwm || true
uci set fstab.rwm=mount
uci set fstab.rwm.device="$ORIG"
uci set fstab.rwm.target=/rwm

uci -q delete fstab.extroot || true
uci set fstab.extroot=mount
uci set fstab.extroot.uuid="$UUID"
uci set fstab.extroot.target=/overlay
uci set fstab.extroot.enabled=1
uci set fstab.@global[0].delay_root=5
uci commit fstab

# Copy the current overlay onto the stick
mkdir -p /tmp/extroot
mount "$DEV" /tmp/extroot
tar -C /overlay -cf - . | tar -C /tmp/extroot -xf -
umount /tmp/extroot
echo "extroot ready on $DEV (UUID $UUID). Reboot now."
