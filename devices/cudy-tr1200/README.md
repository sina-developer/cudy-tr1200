# Cudy TR1200 v1: a full setup guide

How to turn a Cudy TR1200 v1 travel router into:

- OpenWrt 25.12 with **all packages on a USB stick** (extroot), and a copy of the key settings on the internal flash so it still works without the stick;
- a **5 GHz Wi-Fi uplink** (receive on 5 GHz, broadcast your own network on 2.4 GHz) with the **WAN cable as the preferred uplink** and automatic fallback;
- **Passwall2 + Xray** for V2Ray/VLESS servers, including servers that use plain VLESS (no TLS);
- **Deck** as the home page, with the **status LEDs** and the **side slider** switching the VPN.

Everything here was done on a real TR1200 v1 (MT7628AN, 16 MB flash, 128 MB RAM). The helper scripts in `scripts/` were written from those steps afterwards; `patch-passwall2-xray.sh` was checked against the real files, the other two have not been run end to end on a fresh router. Read a script before you run it.

To go back to Cudy's own firmware, see [REVERT.md](REVERT.md).

| Folder | Contents |
|---|---|
| `config/` | Example config files with `<PLACEHOLDERS>`: network, wireless, firewall, fstab, Deck, sysupgrade keep list |
| `scripts/` | `setup-extroot.sh`, `sync-internal-flash.sh`, `patch-passwall2-xray.sh` |

## Hardware notes

| | |
|---|---|
| SoC | MediaTek MT7628AN, 580 MHz MIPS 24KEc, **no FPU** |
| Radios | 2.4 GHz built in (`radio0`), 5 GHz MT7613 on PCIe (`radio1`), **no DFS** channels on 5 GHz |
| Ports | 1x 100M WAN (`eth0.2`), 1x 100M LAN (`eth0.1`), USB 2.0 |
| LEDs | `white:status`, `red:power` |
| Buttons | `reset`, side slider `BTN_0` |
| Flash | 16 MB, about 9 MB free for the overlay: too small for Passwall2 + Xray, hence the USB stick |
| Swap | the stock OpenWrt kernel for this target has no swap support |

## 1. Install OpenWrt

Follow the OpenWrt wiki page: <https://openwrt.org/toh/cudy/tr1200>. In short:

1. Download Cudy's **intermediate firmware** (`TR1200 V1.zip`) from <https://www.cudy.com/blogs/faq/openwrt-software-download> and unzip `TR1200-OpenWRT-Flash.bin`.
2. In the Cudy web page (`http://192.168.10.1`, password `admin`) use **Upgrade Firmware** with that file. Wait 2 minutes.
3. Plug a cable into the **LAN** port (Wi-Fi is off on a fresh OpenWrt) and open `http://192.168.1.1`.
4. Get the **sysupgrade** image for "Cudy TR1200 v1" from <https://firmware-selector.openwrt.org/> and flash it in **System › Backup / Flash Firmware**.

Set a root password straight away (**System › Administration**), and add your SSH key there if you use one. Note: Dropbear on OpenWrt 25.12 may refuse some key types; an RSA key works.

## 2. Change the LAN address (optional)

If your upstream router also uses `192.168.1.x`, move the TR1200 to its own subnet:

```sh
uci set network.lan.ipaddr='192.168.3.1'
uci commit network
/etc/init.d/network restart   # reconnect at the new address
```

## 3. Packages on a USB stick (extroot)

Plug in a USB stick with one partition (`/dev/sda1`). **This erases it.**

```sh
sh setup-extroot.sh /dev/sda1 --format
reboot
df -h /overlay        # now shows the size of the stick
```

What it does: installs `block-mount kmod-usb-storage kmod-fs-ext4 e2fsprogs`, formats the stick as ext4, writes `fstab` (see `config/fstab.example`) and copies the current overlay onto it. The internal overlay stays mounted at `/rwm`.

Without the stick, the router boots from the internal overlay: the plain OpenWrt you had before extroot. Step 7 copies your settings there.

## 4. Wi-Fi uplink with WAN failover

Goal: the 5 GHz radio connects to an upstream Wi-Fi, the 2.4 GHz radio broadcasts your network, and the WAN cable wins whenever it is plugged in.

1. Add a `wwan` interface (DHCP, metric 20) and give `wan`/`wan6` metric 10, see `config/network.example`.
2. Add a client (`mode sta`) on `radio1` attached to `wwan`, keep the 5 GHz access point off, and put your own network on `radio0`, see `config/wireless.example`. Set your `country`.
3. Put `wwan` in the `wan` firewall zone, see `config/firewall.snippet`.
4. `uci commit; wifi reload; /etc/init.d/network reload`.

Both uplinks get a default route; the kernel uses the one with the lowest metric that is up. Pull the cable and traffic moves to Wi-Fi; plug it back and it moves back.

The upstream network must be on a non-DFS 5 GHz channel (36–48 or 149–165), or the client will not connect. You can also pick and join the upstream network from Deck › Network.

## 5. Passwall2 and Xray

Install Passwall2 from its project feed (<https://github.com/Openwrt-Passwall/openwrt-passwall2>; follow their instructions for adding the feed and its signing key on OpenWrt 25.12). Because of the USB overlay there is room for `luci-app-passwall2`, `xray-core` and the geo data.

To keep LuCI in English, do not install the `luci-i18n-passwall2-*` language package, or remove it.

### Plain VLESS servers need Xray 26.2

Xray 26.9 and newer refuse **VLESS without TLS**. If you cannot change your servers, stay on Xray 26.2.x:

1. **Use a softfloat build.** The MT7628 has no FPU; the official `linux-mips32le` Xray from XTLS stops with `Illegal instruction`. The mipsel_24kc `xray-core` packages built for OpenWrt work. Take Xray 26.2.x out of an older OpenWrt `xray-core` package (for example from the Passwall project's release package bundle for `mipsel_24kc`) and copy the binary to `/usr/bin/xray-26.2.4`. The build used here is "Xray 26.2.4 OpenWrt (go1.25.7 linux/mipsle)", sha256 `aab1b5caaac6fae4b253ed74aeafe3d298ddb33ea5ca8285b31de7360afa9dd8`.
2. **Point Passwall2 at it:** `uci set passwall2.@global_app[0].xray_file='/usr/bin/xray-26.2.4'; uci commit passwall2`. The packaged `/usr/bin/xray` can stay installed.
3. **Patch Passwall2** so it accepts that version and writes the config keys Xray 26.2 knows: `sh patch-passwall2-xray.sh`. Run it again after every Passwall2 upgrade.
4. `/etc/init.d/passwall2 restart`.

Then add your nodes and rules in **Services › PassWall 2** as usual.

## 6. Deck, LEDs and the slider

Install Deck (see [docs/install.md](../../docs/install.md)), then copy `config/deck` to `/etc/config/deck` and run `/etc/init.d/deck restart`. The same settings are in Deck › System.

| LED | Meaning |
|---|---|
| white, solid | VPN on and working |
| white, fast blink | VPN switching (or just booted) |
| white, short blip every 5 s | VPN off, internet OK |
| red, blinking | VPN on but the Xray core is not running |
| red, solid | no internet (2 failed checks in a row) |

The **side slider** (`BTN_0`) turns the VPN on (towards the VPN mark: `pressed`) and off. At boot the VPN is set to match the slider position.

The **reset button** keeps the OpenWrt behaviour: a short press reboots; holding it for 5 seconds or more does a factory reset. With extroot this resets the internal flash, so the router comes back as plain OpenWrt without the USB overlay; your files are still on the stick.

## 7. Settings on the internal flash too

```sh
sh sync-internal-flash.sh
```

Copies network, Wi-Fi, firewall, system, DHCP, SSH and web server settings plus the root password from the stick to `/rwm`. If the router ever boots without the stick, it keeps its LAN address, your Wi-Fi and both uplinks (but no VPN or Deck: those packages only live on the stick). Run it again after you change those settings.

## 8. Backups

Add the lines in `config/sysupgrade.conf` to `/etc/sysupgrade.conf`, then:

```sh
sysupgrade -b /tmp/backup-$(date +%F).tar.gz
```

Copy the file off the router (for example `scp -O root@192.168.3.1:/tmp/backup-*.tar.gz .`). **It holds your Wi-Fi passwords, VPN server details and root password hash: never commit it or share it.** This repository's `.gitignore` ignores `private/` for exactly that kind of file.

Restore with **System › Backup / Flash Firmware › Restore backup** or `sysupgrade -r <file>`.
