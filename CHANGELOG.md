# Change Log

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
