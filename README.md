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

```sh
# OpenWrt 25.12 and newer (apk)
apk add --allow-untrusted ./luci-app-deck-*.apk ./luci-theme-deck-*.apk

# OpenWrt 24.10 (opkg)
opkg install ./luci-app-deck_*.ipk ./luci-theme-deck_*.ipk
```

Then open `http://<router>/`: it now opens Deck (you can switch that off in Deck › System). Requirements: `luci-base`, `rpcd-mod-ucode`, `iw`, all standard on OpenWrt 23.05+. To give LuCI's own pages the same look, pick **Deck** under System › System › Language and Style.

Full details, settings and removal: **[docs/install.md](docs/install.md)**.

## Documentation

| | |
|---|---|
| [docs/install.md](docs/install.md) | installing, settings (`/etc/config/deck`), removing |
| [docs/architecture.md](docs/architecture.md) | how the app, the ubus backend, the services and the theme fit together; backend API |
| [docs/development.md](docs/development.md) | trying changes on a router, building packages, ucode pitfalls |

### Device guides

| Router | Guide |
|---|---|
| Cudy TR1200 v1 | [Full setup](devices/cudy-tr1200/README.md): OpenWrt, USB extroot, 5 GHz Wi-Fi uplink with WAN failover, Passwall2 + Xray (plain VLESS), LEDs and slider, backups. [Going back to Cudy firmware](devices/cudy-tr1200/REVERT.md). |

Device guides use example configs with `<PLACEHOLDERS>`. Keep your real configs and `sysupgrade -b` backups in `private/` (git-ignored); they contain Wi-Fi passwords and VPN server details.

## Build from source

The repository is an OpenWrt feed:

```sh
echo "src-git deck <URL of this repository>" >> feeds.conf
./scripts/feeds update deck && ./scripts/feeds install -a -p deck
make package/luci-app-deck/compile package/luci-theme-deck/compile
```

GitHub Actions builds both packages for 24.10 (`.ipk`) and 25.12 (`.apk`) on every push; tagged versions (`v*`) are published as a release. To try changes on a router without packaging, use `scripts/deploy-dev.sh root@<router>` (see [docs/development.md](docs/development.md)).

## Layout

```
luci-app-deck/        dashboard: standalone app (htdocs/deck), rpcd ucode backend, services, config
luci-theme-deck/      LuCI theme: Bootstrap base + Deck layer, templates, side menu
devices/              per-router guides, example configs and helper scripts
docs/                 install, architecture, development
scripts/deploy-dev.sh copy files onto a router for development
```

## Licence

Apache-2.0. The theme's base stylesheet comes from luci-theme-bootstrap (Apache-2.0, the LuCI authors). Fonts: Barlow Condensed and JetBrains Mono, SIL Open Font License 1.1 (see `luci-theme-deck/htdocs/luci-static/deck/fonts/`).
