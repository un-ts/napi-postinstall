---
"napi-postinstall": patch
---

Raise the nested `npm install` output buffer so a successful install is not reported as `ENOBUFS`.
