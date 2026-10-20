---
"napi-postinstall": patch
---

Respect the project's `.npmrc` when a missing platform binding has to be installed by the nested `npm` fallback. Custom registries configured with `registry` and `_authToken` now work instead of falling back to the public registry. The nested install runs from the project directory, so relative values in that file such as `cafile`, `certfile` and `cache` keep pointing at the project.

The registry used by the JS API is resolved from the same config as well, including `@scope:registry`. It stays there when the configured registry answers: neither the manifest lookup nor the tarball download falls back to the public registry, since a public manifest could otherwise decide which package is resolved next. When npm itself cannot be queried at all (no `npm` on the machine, or an unreadable project `.npmrc`), the lookup returns the public default rather than failing.

Known limitation: the project directory is the one npm reports for the install, or the directory that owns the `node_modules` the package was installed into. Workspace roots are not derived, so an install that lands in a member's `node_modules` while the `.npmrc` only exists at the workspace root is not covered yet.

Credentials mirrored into the temporary prefix are written with mode `0600` from the start and removed before the prefix is deleted, so a failed cleanup cannot leave an `_authToken` behind.
