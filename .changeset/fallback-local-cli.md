---
"napi-postinstall": patch
---

Use the locally installed CLI for the runtime fallback instead of invoking `npx`/`pnpm`/`yarn`, accept either a `package.json` path or object, and expose the CLI as `napi-postinstall/cli`.
