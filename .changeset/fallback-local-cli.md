---
"napi-postinstall": patch
---

Use the locally installed CLI for the runtime fallback instead of invoking `npx`/`pnpm`/`yarn`, and expose the CLI as `napi-postinstall/cli`.
