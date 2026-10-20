---
"napi-postinstall": patch
---

Respect the project's `.npmrc` when a missing platform binding has to be installed by the nested `npm` fallback. Custom registries configured with `registry` and `_authToken` now work instead of falling back to the public registry. The nested install runs from the project directory, so relative values in that file such as `cafile`, `certfile` and `cache` keep pointing at the project, and the registry used by the direct download fallback is resolved from the same config.
