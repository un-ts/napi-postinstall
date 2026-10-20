---
"napi-postinstall": patch
---

Respect the project's `.npmrc` when a missing platform binding has to be installed by the nested `npm` fallback. Custom registries configured with `registry` and `_authToken` now work instead of falling back to the public registry. The nested install runs from the project directory, so relative values in that file such as `cafile`, `certfile` and `cache` keep pointing at the project.

The registry used by the JS API is resolved from the same config: the manifest lookup retries the public registry because those requests carry no credentials and it only reads metadata, while the tarball download never leaves the configured registry, so a private package cannot be resolved to a public one.

Known limitation: the project directory is inferred without parsing workspace patterns. A `workspaces` entry is matched by its static prefix, and every descendant of a `pnpm-workspace.yaml` counts as a member.
