# Deck

A simple dashboard and theme for OpenWrt routers.

Deck is two packages:

| Package | What it does |
|---|---|
| **luci-app-deck** | A standalone dashboard at `http://<router>/deck/` with its own login, side menu (bottom tabs on phones) and screens: Home, VPN, Network, Devices, System. It shows only what *your* router can do. It talks to the router through OpenWrt's ubus API with the root password; LuCI stays available as “Advanced”, and logging into Deck logs you into LuCI too. |
| **luci-theme-deck** | The Deck look for every LuCI page, including app pages such as PassWall 2. Side menu, dark and light, phone layout. Built on LuCI's Bootstrap stylesheet so every LuCI widget keeps working. |

Each package works on its own. Install both for the full look.

## Works on any router

Nothing is hard-coded to one model. Deck detects at runtime:

| Feature | Detected from | If missing |
|---|---|---|
| VPN app | PassWall 2 (`/etc/config/passwall2`) | VPN page and switch are hidden |
| Status LEDs | `/sys/class/leds` (Wi-Fi PHY LEDs ignored) | LED settings are hidden |
| Buttons and switches | device tree `gpio-keys` | VPN button setting is hidden |
| Wi-Fi radios | `network.wireless` | Wi-Fi cards show "no radio" |
| Internet uplinks and backup | interfaces in the WAN firewall zone, by metric | single uplink shown |
| External storage | `/overlay` on USB / SD | storage shows built-in flash |
| Temperature | thermal zones / hwmon | not shown |

Optional extras are **off by default** and never take over anything the router already has:

- **LED status** (Dashboard › System): solid = VPN on, fast blink = switching, short blip = VPN off, alert blink = VPN core failed, alert solid = no internet.
- **Hardware VPN switch**: map a slider or button to VPN on/off. A button that already has its own `/etc/rc.button` script is left alone.
- **Internet checks**: plain-http 204 checks every 15 s (on by default, only reads).

VPN credentials (server addresses, ports, keys, UUIDs) are never sent to the browser by Deck.

## Install

From a release (both packages are architecture-independent):

```sh
# OpenWrt 25.12 and newer (apk)
apk add --allow-untrusted ./luci-app-deck-*.apk ./luci-theme-deck-*.apk

# OpenWrt 24.10 (opkg)
opkg install ./luci-app-deck_*.ipk ./luci-theme-deck_*.ipk
```

Then open `http://<router>/deck/` (LuCI also gets a “Dashboard” menu item that opens it). To give LuCI's own pages the same look, pick **Deck** under System › System › Language and Style. Installing the theme does not switch to it by itself.

Requirements: `luci-base`, `rpcd-mod-ucode`, `iw` (all standard on OpenWrt 23.05+).

## Build from source

Add the feed to an OpenWrt SDK or buildroot:

```sh
echo "src-git deck [REPOSITORY URL]" >> feeds.conf
./scripts/feeds update deck && ./scripts/feeds install -a -p deck
make package/luci-app-deck/compile package/luci-theme-deck/compile
```

GitHub Actions builds both packages for 24.10 (`.ipk`) and 25.12 (`.apk`) on every push; tagged versions (`v*`) are published as a release.

## Develop on a router

`scripts/deploy-dev.sh root@192.168.1.1` copies the files straight onto a router (no package manager). It never changes the owner or mode of existing folders and keeps an existing `/etc/config/deck`. After changing the backend plugin, run `/etc/init.d/rpcd restart` on the router (this logs out open LuCI sessions).

## Layout

```
luci-app-deck/
  root/usr/share/rpcd/ucode/deck        backend: capabilities, status, devices, events, vpn_* (ubus object "deck")
  root/usr/share/rpcd/acl.d/            permissions
  root/usr/share/luci/menu.d/           menu entries
  root/usr/libexec/deck/{vpn,monitor,button}   VPN worker, internet/LED monitor, button hook
  root/etc/init.d/deck, root/etc/config/deck
  htdocs/deck/                          the standalone app: index.html, app.js, app.css, components.css, fonts
  htdocs/luci-static/resources/view/deck/open.js   LuCI menu entry that opens /deck/
luci-theme-deck/
  ucode/template/themes/deck/           header, footer, login
  htdocs/luci-static/deck/              cascade.css (Bootstrap base), deck.css (Deck layer), fonts
  htdocs/luci-static/resources/menu-deck.js
```

## Licence

Apache-2.0. The theme's base stylesheet comes from luci-theme-bootstrap (Apache-2.0, the LuCI authors). Fonts: Barlow Condensed and JetBrains Mono, SIL Open Font License 1.1 (see `luci-theme-deck/htdocs/luci-static/deck/fonts/`).
