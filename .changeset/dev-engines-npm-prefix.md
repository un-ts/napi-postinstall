---
"napi-postinstall": patch
---

Avoid `EBADDEVENGINES` when the caller declares a different `devEngines.packageManager` by running the fallback `npm install` with the temporary directory as its prefix.
