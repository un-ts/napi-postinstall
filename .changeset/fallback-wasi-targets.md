---
"napi-postinstall": patch
---

Support WASI packages that do not declare the WASI binding in `optionalDependencies`.

The fallback now checks `napi.targets` as well, matching napi's policy of keeping the WASI fallback out of `optionalDependencies` when it is not the only target.
