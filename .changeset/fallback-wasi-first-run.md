---
"napi-postinstall": patch
---

Load the installed WASI binding when re-requiring the host package after the install fallback still fails, so the first run in a pnpm layout can use the WASM build instead of throwing. This covers the NetBSD/pnpm case in unrs-resolver#233.
