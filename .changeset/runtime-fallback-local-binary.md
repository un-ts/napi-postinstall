---
"napi-postinstall": patch
---

Copy the installed binding binary to the loader's local path so the runtime fallback still works when Node has cached the failed package lookup.
