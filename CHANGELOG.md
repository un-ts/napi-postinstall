# Change Log

## 0.3.6

### Patch Changes

- [#73](https://github.com/un-ts/napi-postinstall/pull/73) [`d95190c`](https://github.com/un-ts/napi-postinstall/commit/d95190cf54852d583858e38367ba087cc9887f7c) Thanks [@JounQin](https://github.com/JounQin)! - Support WASI targets listed in `napi.targets` when the WASI binding is not declared in `optionalDependencies`, matching the fallback behavior.

- [#70](https://github.com/un-ts/napi-postinstall/pull/70) [`6527bce`](https://github.com/un-ts/napi-postinstall/commit/6527bce41a861a538bb719eca298dd9e0e68106f) Thanks [@JounQin](https://github.com/JounQin)! - Avoid `EBADDEVENGINES` when the caller declares a different `devEngines.packageManager` by running the fallback `npm install` with the temporary directory as its prefix.

- [#75](https://github.com/un-ts/napi-postinstall/pull/75) [`b4ee025`](https://github.com/un-ts/napi-postinstall/commit/b4ee025a716f83eb086a5ee36b26498d8776800a) Thanks [@JounQin](https://github.com/JounQin)! - Use the locally installed CLI for the runtime fallback instead of invoking `npx`/`pnpm`/`yarn`, and expose the CLI as `napi-postinstall/cli`. This also removes the package-manager and Deno detection from the fallback.

- [#76](https://github.com/un-ts/napi-postinstall/pull/76) [`a94c0db`](https://github.com/un-ts/napi-postinstall/commit/a94c0db49cfdafec313c4b8f80c198d8eb97d785) Thanks [@JounQin](https://github.com/JounQin)! - Respect the project's `.npmrc` when a missing platform binding has to be installed by the nested `npm` fallback. Custom registries configured with `registry` and `_authToken` now work instead of falling back to the public registry. The nested install runs from the project directory, so relative values in that file such as `cafile`, `certfile` and `cache` keep pointing at the project.

  The registry used by the JS API is resolved from the same config as well, including `@scope:registry`. It stays there when the configured registry answers: neither the manifest lookup nor the tarball download falls back to the public registry, since a public manifest could otherwise decide which package is resolved next. When npm itself cannot be queried at all (no `npm` on the machine, or an unreadable project `.npmrc`), the lookup returns the public default rather than failing, and says so in the log.

  Known limitations:

  - A cross-device move copies the tree, and Node below 16.15 ignores `verbatimSymlinks`, so symlinks inside it (such as `node_modules/.bin` for a WASI install) are resolved against the source that is then removed. Node 16.7-16.14 failed that move outright before, so nothing regresses, but the links can break there.
  - The project directory is the one npm reports for the install, or the directory that owns the `node_modules` the package was installed into. Workspace roots are not derived, so an install that lands in a member's `node_modules` while the `.npmrc` only exists at the workspace root is not covered yet.

  Credentials mirrored into the temporary prefix are written with mode `0600` from the start, so the copy is never readable by other users; the prefix itself is created by `mkdtemp` and is `0700`.

- [#78](https://github.com/un-ts/napi-postinstall/pull/78) [`86ff5e0`](https://github.com/un-ts/napi-postinstall/commit/86ff5e03d613cb691d043f6726c9bca45b18e981) Thanks [@i1stG](https://github.com/i1stG)! - Resolve the host manifest and the installed binding from the directory the postinstall runs in. In a pnpm-style layout with `hoist=false` the binding is a sibling of the host package in the consumer's `node_modules`, while `napi-postinstall` can be linked from a tree that cannot see it, so the lookup used to fall through to the nested install and then to a download — which fails in an offline sandbox. In a normal npm, yarn or pnpm install the cwd is the package that needs the binding, so nothing changes for them.

## 0.3.5

### Patch Changes

- [#63](https://github.com/un-ts/napi-postinstall/pull/63) [`7ef37fe`](https://github.com/un-ts/napi-postinstall/commit/7ef37febcc89454061fd0692d7d56e5278924970) Thanks [@JounQin](https://github.com/JounQin)! - Support WASI packages that do not declare the WASI binding in `optionalDependencies`.

  The fallback now checks `napi.targets` as well, matching napi's policy of keeping the WASI fallback out of `optionalDependencies` when it is not the only target.

## 0.3.4

### Patch Changes

- [#56](https://github.com/un-ts/napi-postinstall/pull/56) [`9ce741b`](https://github.com/un-ts/napi-postinstall/commit/9ce741b33e71f450a6537198ba9c0316ce4380de) Thanks [@JounQin](https://github.com/JounQin)! - feat: add support for loong64 arch and openharmony platform

## 0.3.3

### Patch Changes

- [#47](https://github.com/un-ts/napi-postinstall/pull/47) [`8447abb`](https://github.com/un-ts/napi-postinstall/commit/8447abbbd8cd8aa2640f7b0e58643f386f75eb78) Thanks [@WooWan](https://github.com/WooWan)! - feat: support for HTTP protocol in private registries

- [#51](https://github.com/un-ts/napi-postinstall/pull/51) [`1d9c7d5`](https://github.com/un-ts/napi-postinstall/commit/1d9c7d56ce5266046409167ba31fb9aa079c3d9e) Thanks [@mrginglymus](https://github.com/mrginglymus)! - feat: try reading `package.json` from `cwd` for cli usage

## 0.3.0

### Minor Changes

- [#40](https://github.com/un-ts/napi-postinstall/pull/40) [`d4719ff`](https://github.com/un-ts/napi-postinstall/commit/d4719ff3f0ab55381ef715d11d09ca537ab7a59e) Thanks [@JounQin](https://github.com/JounQin)! - feat: add runtime fallback and webcontainer support

## 0.2.5

### Patch Changes

- [#38](https://github.com/un-ts/napi-postinstall/pull/38) [`76b34bd`](https://github.com/un-ts/napi-postinstall/commit/76b34bd25c29e53bcbedf1c51de945b8b49234f1) Thanks [@WooWan](https://github.com/WooWan)! - feat: handle 307 and 308 redirect status codes

## 0.2.4

### Patch Changes

- [#32](https://github.com/un-ts/napi-postinstall/pull/32) [`6195df6`](https://github.com/un-ts/napi-postinstall/commit/6195df6f93c1418603e54c0ad8c3e9eea3b0f35b) Thanks [@JounQin](https://github.com/JounQin)! - fix: target `ES2020` for Node <15 compatibility

## 0.2.3

### Patch Changes

- [#27](https://github.com/un-ts/napi-postinstall/pull/27) [`f52b3e9`](https://github.com/un-ts/napi-postinstall/commit/f52b3e9c8056df85b4c16faab29c26bc830fe49a) Thanks [@JounQin](https://github.com/JounQin)! - fix: `newPath` dir could be unavailable, make sure it's already there

## 0.2.2

### Patch Changes

- [#25](https://github.com/un-ts/napi-postinstall/pull/25) [`2eb7867`](https://github.com/un-ts/napi-postinstall/commit/2eb78677ff0de44c01617f2f078a493251b73172) Thanks [@mrginglymus](https://github.com/mrginglymus)! - fix: give up patching `yarn` pnp automatically which is impossible

## 0.2.1

### Patch Changes

- [#23](https://github.com/un-ts/napi-postinstall/pull/23) [`f14cd3f`](https://github.com/un-ts/napi-postinstall/commit/f14cd3fe0d10445eb41c3c1df28d9f3378b38639) Thanks [@JounQin](https://github.com/JounQin)! - fix: always use `wasm32-wasi` target for `webcontainer`

## 0.2.0

### Minor Changes

- [#21](https://github.com/un-ts/napi-postinstall/pull/21) [`2d6c726`](https://github.com/un-ts/napi-postinstall/commit/2d6c726310885bb674ce5c93fb0c8b18a2261575) Thanks [@JounQin](https://github.com/JounQin)! - feat: support reading `package.json` from npm registry

- [#21](https://github.com/un-ts/napi-postinstall/pull/21) [`2d6c726`](https://github.com/un-ts/napi-postinstall/commit/2d6c726310885bb674ce5c93fb0c8b18a2261575) Thanks [@JounQin](https://github.com/JounQin)! - feat: support `yarn`/`pnpm` seamlessly for `webcontainer`

## 0.1.6

### Patch Changes

- [#18](https://github.com/un-ts/napi-postinstall/pull/18) [`8a887ee`](https://github.com/un-ts/napi-postinstall/commit/8a887eec5879cf495cc1e95cf80f26a422114b28) Thanks [@JounQin](https://github.com/JounQin)! - fix: support install `wasm32-wasi` correctly with `--cpu=wasm32`

## 0.1.5

### Patch Changes

- [`c88dc0c`](https://github.com/un-ts/napi-postinstall/commit/c88dc0cf96c82ca81b659eecc8a596ab28b8f686) Thanks [@JounQin](https://github.com/JounQin)! - fix: isNpm detection

## 0.1.4

### Patch Changes

- [`87ecdd2`](https://github.com/un-ts/napi-postinstall/commit/87ecdd2be320e0095efca493032d51e1c7b0136c) Thanks [@JounQin](https://github.com/JounQin)! - fix: only check for npm

## 0.1.3

### Patch Changes

- [#12](https://github.com/un-ts/napi-postinstall/pull/12) [`5b8ff18`](https://github.com/un-ts/napi-postinstall/commit/5b8ff180f09480a8a64726b6fc7547f34fa305b0) Thanks [@JounQin](https://github.com/JounQin)! - chore: remove unnecessary `tslib` by targeting ES2021

## 0.1.2

### Patch Changes

- [#8](https://github.com/un-ts/napi-postinstall/pull/8) [`68a8acc`](https://github.com/un-ts/napi-postinstall/commit/68a8accf944c72867a9543e6f198b962b5414109) Thanks [@JounQin](https://github.com/JounQin)! - fix: `tslib` should be listed as dependency

## 0.1.1

### Patch Changes

- [#6](https://github.com/un-ts/napi-postinstall/pull/6) [`c56e93a`](https://github.com/un-ts/napi-postinstall/commit/c56e93adbb2baa13293cdd587ff05d0f855a34c2) Thanks [@JounQin](https://github.com/JounQin)! - fix: allow optional `optionalDependencies` for development

## 0.1.0

### Minor Changes

- [#3](https://github.com/un-ts/napi-postinstall/pull/3) [`cc98bce`](https://github.com/un-ts/napi-postinstall/commit/cc98bced86bb7d5198a223f86ad25270426511e9) Thanks [@JounQin](https://github.com/JounQin)! - feat: first blood, should just work
