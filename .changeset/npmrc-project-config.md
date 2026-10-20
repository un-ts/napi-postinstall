---
"napi-postinstall": patch
---

Respect the project's `.npmrc` when a missing platform binding has to be installed by the nested `npm` fallback. Custom registries configured with `registry` and `_authToken` now work instead of falling back to the public registry. The nested install runs from the project directory, so relative values in that file such as `cafile`, `certfile` and `cache` keep pointing at the project.

The registry used by the JS API is resolved from the same config as well, and stays there: neither the manifest lookup nor the tarball download falls back to the public registry, because those requests carry no credentials and a public manifest could otherwise decide which package is resolved next. A private registry that requires authentication on reads now fails those lookups with its own error instead of resolving a public package of the same name.

Known limitation: the project directory is inferred without parsing workspace patterns. A `workspaces` entry is matched by its static prefix, and every descendant of a `pnpm-workspace.yaml` counts as a member.
