# Installing Deck

Deck is two packages. Both are architecture-independent, so the same files work on any router.

| Package | Needs |
|---|---|
| `luci-app-deck` | `luci-base`, `rpcd-mod-ucode`, `iw` |
| `luci-theme-deck` | `luci-base` |

Supported: OpenWrt 24.10 (`.ipk`, opkg) and 25.12 or newer (`.apk`).

## From a release

Download the packages from the [Releases page](https://github.com/sina-developer/cudy-tr1200/releases) (or the build artifacts of the GitHub Actions run), copy them to the router and install:

```sh
scp -O luci-*-deck* root@192.168.1.1:/tmp/
ssh root@192.168.1.1

# OpenWrt 25.12 and newer
apk add --allow-untrusted /tmp/luci-app-deck-*.apk /tmp/luci-theme-deck-*.apk
# OpenWrt 24.10
opkg install /tmp/luci-app-deck_*.ipk /tmp/luci-theme-deck_*.ipk
```

`--allow-untrusted` is needed because the packages are not signed with your router's key.

## After installing

- `http://<router>/` now opens Deck (`/deck/`). LuCI is still at `/cgi-bin/luci/`, and Deck links to it as "LuCI".
  To keep LuCI as the start page: Deck › System › "Open Deck at <router address>" off, or `uci set deck.main.home=0; uci commit deck; /etc/init.d/deck restart`.
- Log in with the router's root password. Logging in to Deck also logs you in to LuCI.
- Installing the theme does not switch LuCI to it. Pick **Deck** in LuCI › System › System › Language and Style.
- LED status and the VPN button are **off** until you turn them on in Deck › System. See [configuration](#configuration).

## Configuration

`/etc/config/deck`:

| Section.option | Default | Meaning |
|---|---|---|
| `main.home` | `1` | open Deck at `http://<router>/` instead of LuCI |
| `monitor.enabled` | `1` | check the internet connection |
| `monitor.interval` | `15` | seconds between checks |
| `monitor.fails` | `2` | failed checks in a row before the internet counts as down |
| `monitor.url` | two plain-http `generate_204` URLs | check targets (list) |
| `led.enabled` | `0` | show VPN and internet status on the LEDs |
| `led.ok_led` / `led.alert_led` | empty | LED names from `/sys/class/leds` (e.g. `white:status`, `red:power`) |
| `led.off_blip` | `5000` | while the VPN is off, blip the LED every N ms |
| `vpn_button.name` | empty | button or switch from `/etc/rc.button` naming (e.g. `BTN_0`) |
| `vpn_button.on_event` | `pressed` | which event means "VPN on" for a two-position switch |

Run `/etc/init.d/deck restart` after editing by hand.

## Removing

```sh
apk del luci-app-deck luci-theme-deck     # or: opkg remove ...
```

Removing `luci-app-deck` puts the original start page back and removes its button hooks. Removing the theme switches LuCI back to Bootstrap if Deck was selected.

## Device guides

- [Cudy TR1200 v1](../devices/cudy-tr1200/README.md): full setup with extroot, Wi-Fi uplink failover, Passwall2 + Xray, LEDs and slider; and [going back to Cudy firmware](../devices/cudy-tr1200/REVERT.md).
