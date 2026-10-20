---
"napi-postinstall": patch
---

Use the locally installed CLI for the runtime fallback instead of invoking `npx`/`pnpm`/`yarn`, and expose the CLI as `napi-postinstall/cli`. This also removes the package-manager and Deno detection from the fallback.
