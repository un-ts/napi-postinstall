---
"napi-postinstall": patch
---

Support WASI targets listed in `napi.targets` when the WASI binding is not declared in `optionalDependencies`, matching the fallback behavior.
