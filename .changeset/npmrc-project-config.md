---
"napi-postinstall": patch
---

Respect the project's `.npmrc` when a missing platform binding has to be installed by the nested `npm` fallback. Custom registries configured with `registry` and `_authToken` now work instead of falling back to the public registry, path values such as `cafile`, `cache` and `prefix` keep working after the config is mirrored into a temporary prefix, and the registry used by the direct download fallback is resolved from the same project config.
