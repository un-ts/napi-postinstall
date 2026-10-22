---
"napi-postinstall": patch
---

Add a `napi-patch` bin for injecting the all-platform runtime fallback into generated napi-rs loaders. It inserts the all-platform fallback before the loader's final `if (!nativeBinding)` check, with no WebContainer-only guard. The API accepts an entry, package name and extra text to append; nested entries such as `napi/index.js` are supported. The inserted fallback is guarded by `SKIP_<PACKAGE>_FALLBACK`; scoped names are encoded as `SKIP_SCOPE_PACKAGE_FALLBACK`. A loader that already ran the fallback gives up instead of starting another nested install.
