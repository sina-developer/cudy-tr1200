# Going back to Cudy's firmware (TR1200 v1)

You can return the TR1200 to Cudy's own firmware. Afterwards the Cudy web page and the Cudy app work again, and all OpenWrt settings are gone.

Sources: the OpenWrt wiki page <https://openwrt.org/toh/cudy/tr1200> and Cudy's OpenWrt download page <https://www.cudy.com/blogs/faq/openwrt-software-download>. Cudy says how to restore its firmware in the **readme inside the download**. If the readme says something different from this page, follow the readme.

> Flashing the wrong file can leave the router unable to boot. Use files for **TR1200 V1** only, and keep the router powered the whole time.

## Before you start

1. **Back up OpenWrt** in case you want it back: `sysupgrade -b /tmp/backup.tar.gz`, then copy the file off the router. It contains passwords: keep it private.
2. **Unplug the USB stick.** Cudy's firmware does not use it, and you keep your OpenWrt overlay on it.
3. Use a **network cable**, not Wi-Fi.

## Get the files

From the Cudy page above, download the OpenWrt package for the TR1200 (`TR1200 V1.zip`, linked from "Download OpenWrt Firmware to Remove Signature Check"). Read its readme: it explains how to go back to Cudy's firmware and which file to use.

Download Cudy's official TR1200 V1 firmware from the TR1200 product or download page on cudy.com (the OpenWrt wiki links it as "OEM Firmware").

Cudy's own web page only accepts firmware signed by Cudy, and Cudy's recovery mode only accepts Cudy firmware. OpenWrt images will not work in either.

## Way 1: from OpenWrt (follow Cudy's readme)

Do the steps from the readme. For a flash from OpenWrt they normally look like this:

1. Open LuCI › **System › Backup / Flash Firmware › Flash new firmware image**.
2. Choose the file the readme names.
3. **Untick "Keep settings"**. If LuCI warns that the image format is not recognised, tick **Force upgrade** only if the readme says to.
4. Flash and wait at least 3 minutes. Don't unplug it.

From the command line the same is:

```sh
cd /tmp                      # copy the file here first (scp -O file root@<router>:/tmp/)
sysupgrade -n -F <file>.bin  # -n: do not keep settings, -F: force
```

## Way 2: Cudy recovery (reset button and TFTP)

Use this if OpenWrt no longer boots, or if Way 1 is refused. The Cudy bootloader has a TFTP recovery mode, started with the **Reset** button, and it takes **Cudy firmware only** (OpenWrt wiki, "Debricking").

The exact values come from Cudy's TFTP recovery guide. Check them in the readme or on cudy.com for your model. For Cudy routers they are usually:

| | |
|---|---|
| Your computer's IP | `192.168.1.88` / `255.255.255.0`, set by hand, no gateway |
| TFTP server | any TFTP server on your computer (for example `tftpd64` on Windows, or `tftp` / `dnsmasq --enable-tftp` on macOS and Linux) |
| File name | the Cudy firmware renamed to `recovery.bin` in the TFTP root folder |
| Start | power off, hold **Reset**, power on, keep holding until the LED changes, then let go |

The router downloads the file and flashes itself. That takes a few minutes. Do not power it off.

## Afterwards

- Set your computer back to automatic IP (DHCP).
- The Cudy web page is at `http://192.168.10.1`, password `admin` on a fresh router. Do a factory reset from there if you see any leftover settings.
- The Cudy app works again.
- To install OpenWrt again later, start from step 1 of [README.md](README.md).
