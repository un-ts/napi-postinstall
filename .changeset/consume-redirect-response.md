---
"napi-postinstall": patch
---

fix: consume redirect and non-200 responses so the keep-alive socket is released and the process can exit
