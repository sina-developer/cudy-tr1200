# How Deck works

```
browser ── /deck/ (static app) ──► /ubus (JSON-RPC, uhttpd) ──► rpcd ──► "deck" ucode plugin
                                                                     └──► system, uci, session
router:   /etc/init.d/deck ──► monitor (internet checks, LEDs)
          /etc/rc.button/<name> ──► button hook ──► vpn worker ──► VPN app (Passwall2)
```

## Front end: `luci-app-deck/htdocs/deck/`

A single-page app with no build step and no framework: `index.html`, `app.js`, `app.css`, `components.css`, bundled fonts. Screens are hash routes: `#home`, `#vpn`, `#network`, `#devices`, `#system`. Phones get bottom tabs instead of the side menu.

- **Login** calls `session.login` with user `root`. The session id is kept in the browser (`sessionStorage`, or `localStorage` when you stay signed in). The app also posts the LuCI login form, so the "LuCI" link opens without a second login.
- **Polling**: `deck.status` every 5 s while the tab is visible. A response that arrives during a redraw is kept and drawn next.
- **Session end**: ubus errors `-32002` / code 6 send you back to the login page. "Object not found" (rpcd reloading) is retried instead.
- **Settings** use `uci.set` + `uci.commit`; Wi-Fi changes then call `deck.wifi_reload`.

The LuCI menu has one entry, **Dashboard** (`admin/deck`), which opens `/deck/`.

## Back end: `luci-app-deck/root/usr/share/rpcd/ucode/deck`

An rpcd ucode plugin providing the ubus object `deck`. It reads `/proc`, `/sys` and UCI, and runs `iw`, `logread` and `pidof`.

Rule: the plugin runs **inside rpcd**, so it must never call other rpcd-provided ubus objects (`iwinfo`, `luci-rpc`, ...). That deadlocks rpcd. Use `iw` and files instead.

| Method | Args | Returns |
|---|---|---|
| `capabilities` | | what this router has: VPN provider, LEDs, buttons (with current state), radios, uplinks, storage, temperature |
| `status` | | board, uptime, memory, CPU counters (`/proc/stat`), temperature, storage, VPN state, uplinks, Wi-Fi, LED and button settings, internet check result, LAN |
| `devices` | | clients from DHCP leases, ARP and `iw station dump`, with names from DHCP host entries |
| `events` | `limit` (30) | recent log lines, parsed |
| `vpn_nodes` | | VPN servers: id, name, type. **No addresses, ports or keys** |
| `vpn_rules` | | routing rules of the VPN app |
| `wifi_scan` | `device` | nearby networks from `iw scan` |
| `wifi_reload` | | runs `wifi reload` |
| `vpn_set` | `enabled` | turns the VPN on or off (through the vpn worker) |
| `vpn_restart` | | restarts the VPN app |
| `vpn_select` | `node` | switches the active VPN server |

Permissions are in `root/usr/share/rpcd/acl.d/luci-app-deck.json`: read access to the `deck` read methods, `system.board/info` and UCI `deck wireless network dhcp system`; write access to the `deck` write methods, `system.reboot`, UCI set/commit for `deck` and `wireless`, and `session.destroy`.

### VPN providers

VPN apps are adapters in the `providers` table (`id, detect, app, luci, status, nodes, rules, set_enabled, select`). Only `passwall2` exists today. A new provider (OpenVPN, WireGuard, ...) is one more entry. If no provider is detected, the VPN screens and switch are hidden.

Passwall2 state is read without text matching on process lists:

- **busy** = Passwall2 holds the flock on `/tmp/lock/passwall2.lock` (found in `/proc/locks` by inode);
- **core running** = `pidof` of the binaries in `/tmp/etc/passwall2/bin`.

## Services: `luci-app-deck/root/usr/libexec/deck/`

| Script | Role |
|---|---|
| `monitor` | procd service. Checks internet every `monitor.interval` s (`uclient-fetch`, `curl` or `wget`), writes `/var/run/deck/net.*`, and drives the LEDs when `led.enabled=1`. Wakes every 2 s for LED state. |
| `vpn` | the only thing that starts or stops the VPN: `reconcile`, `restart`, `set on|off`, `button pressed|released`. One worker at a time (`/var/run/deck/vpn.lock`); requests while it runs set an "again" flag. During the first 120 s after boot a button event only sets the flag. |
| `button` | `/etc/rc.button/<name>` symlink target. Runs the vpn worker in the background. |
| `home` | `on`: replaces `/www/index.html` with a redirect to `/deck/` (original kept as `index.html.luci`). `off`: restores it. |

`/etc/init.d/deck` (START=19, before most VPN apps) links the button hook, never taking over a button that already has its own handler; sets the VPN to match a two-position switch at boot; applies `home`; and runs the monitor.

### LED patterns

| State | LED |
|---|---|
| VPN on and working, or no VPN app | ok LED solid |
| switching | ok LED blink 120/120 ms |
| VPN off | ok LED short blip every `off_blip` ms |
| VPN on, core not running | alert LED blink 400/400 ms |
| no internet | alert LED solid |

If only one LED is set, it is used for everything.

## Theme: `luci-theme-deck/`

LuCI's Bootstrap stylesheet (`cascade.css`, unchanged apart from attribution) plus a Deck layer (`deck.css`), ucode templates for the header, footer and login page, and `menu-deck.js` for the side menu. Because the base is Bootstrap, every LuCI page and app page keeps working. Fonts come from `/deck/fonts/`, so the theme expects `luci-app-deck` for the Deck typefaces and falls back to system fonts without it.
