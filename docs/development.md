# Developing Deck

## Repository layout

```
luci-app-deck/            dashboard package (LuCI feed layout, luci.mk)
  htdocs/deck/            the standalone app
  root/                   files installed as-is: rpcd plugin, ACL, menu, init script, config, scripts
luci-theme-deck/          LuCI theme package
devices/<model>/          per-device guides, example configs and helper scripts
docs/                     install, architecture, development
scripts/deploy-dev.sh     copy the files onto a router without packaging
private/                  git-ignored: put real backups and configs here, never commit them
```

The repository root is an OpenWrt feed: each package folder has a `luci.mk` Makefile.

## Try changes on a router

```sh
scripts/deploy-dev.sh root@192.168.1.1
```

It copies both packages' files onto the router over SSH, keeps an existing `/etc/config/deck`, and never changes the owner or mode of existing folders (it packs only the top-level folders, owned by root, and extracts with `tar -o`). Do not "simplify" this into packing `.`: that changes the owner and mode of `/` and breaks ubus.

After changing the backend plugin or the ACL:

```sh
/etc/init.d/rpcd restart     # `reload` does not reload ucode plugins; this logs out open sessions
```

Front-end changes only need a browser reload. Bump the `?v=` numbers in `htdocs/deck/index.html` when you release, so browsers fetch the new files.

Call the backend directly on the router:

```sh
ubus call deck capabilities
ubus call deck status
ubus -v list deck
```

## ucode notes

The rpcd ucode runtime is small. Things that bit us:

- no `??=`; no `Object.assign` (the plugin has a `merge()` helper);
- object keys must be strings, not numbers;
- don't give a `const` the same name as the function you're calling.

Never call `iwinfo`, `luci-rpc` or other rpcd objects from the plugin (deadlock). Never detect processes with `pgrep -f` text matching: the checking shell matches itself. Use `pidof`, lock files in `/proc/locks`, or PID files.

## Build packages

CI (`.github/workflows/build.yml`) builds with the official OpenWrt SDK through `openwrt/gh-action-sdk`, for 24.10 (`.ipk`) and 25.12 (`.apk`), on every push and pull request. Tags `v*` publish a release.

Locally, with an OpenWrt SDK:

```sh
echo "src-link deck /path/to/this/repo" >> feeds.conf
./scripts/feeds update deck && ./scripts/feeds install -a -p deck
make package/luci-app-deck/compile package/luci-theme-deck/compile V=s
```

## Adding a device guide

Create `devices/<vendor>-<model>/` with a `README.md`, example configs in `config/` using `<PLACEHOLDERS>`, and scripts in `scripts/`. Never put real Wi-Fi passwords, server addresses, keys, MAC addresses or backups in the repository: keep those in `private/`.
