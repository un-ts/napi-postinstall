---
"napi-postinstall": patch
---

Load the installed WASI binding when re-requiring the host package after the install fallback still fails, so the first run in a pnpm layout can use the WASM build instead of throwing. Restore the `SKIP_*_FALLBACK` guard afterwards so another copy of the host package can still run its own fallback. This covers the NetBSD/pnpm case in unrs-resolver#233.
