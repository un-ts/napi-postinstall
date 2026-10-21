---
"napi-postinstall": patch
---

Resolve the host manifest and the installed binding from the directory the postinstall runs in. In a pnpm-style layout with `hoist=false` the binding is a sibling of the host package in the consumer's `node_modules`, while `napi-postinstall` can be linked from a tree that cannot see it, so the lookup used to fall through to the nested install and then to a download — which fails in an offline sandbox. In a normal npm, yarn or pnpm install the cwd is the package that needs the binding, so nothing changes for them.
