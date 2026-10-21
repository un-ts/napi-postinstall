# napi-postinstall

[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/un-ts/napi-postinstall/ci.yml?branch=main)](https://github.com/un-ts/napi-postinstall/actions/workflows/ci.yml?query=branch%3Amain)
[![Codecov](https://img.shields.io/codecov/c/github/un-ts/napi-postinstall.svg)](https://codecov.io/gh/un-ts/napi-postinstall)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fun-ts%2Fnapi-postinstall%2Fmain%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/un-ts/napi-postinstall)](https://coderabbit.ai)
[![npm](https://img.shields.io/npm/v/napi-postinstall.svg)](https://www.npmjs.com/package/napi-postinstall)
[![GitHub Release](https://img.shields.io/github/release/un-ts/napi-postinstall)](https://github.com/un-ts/napi-postinstall/releases)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![changesets](https://img.shields.io/badge/maintained%20with-changesets-176de3.svg)](https://github.com/changesets/changesets)

The `postinstall` script helper for handling native bindings in `npm` versions
affected by [npm/cli#4828](https://github.com/npm/cli/issues/4828). This is a
reimplementation of the [`node-install`][node-install] functionality from
[`esbuild`][esbuild] for [`napi-rs`][napi-rs] ecosystem packages like
[`rollup`][rollup], [`@swc/core`][swc-core] and [`unrs-resolver`][unrs-resolver].

For more details, please refer to the following issues:

- [npm/cli#4828](https://github.com/npm/cli/issues/4828) -- root cause
- [napi-rs/napi-rs#2569](https://github.com/napi-rs/napi-rs/issues/2569)
- [unrs/unrs-resolver#56](https://github.com/unrs/unrs-resolver/issues/56)

## TOC <!-- omit in toc -->

- [Usage](#usage)
  - [TL;DR for package users](#tldr-for-package-users)
  - [Notes for package authors](#notes-for-package-authors)
  - [Install](#install)
  - [Postinstall script](#postinstall-script)
  - [CLI](#cli)
  - [API](#api)
    - [Types](#types)
    - [Example](#example)
- [Sponsors and Backers](#sponsors-and-backers)
  - [Sponsors](#sponsors)
  - [Backers](#backers)
- [Changelog](#changelog)
- [License](#license)

## Usage

### TL;DR for package users

You usually don't need to install `napi-postinstall` yourself — it is a
`postinstall` helper used by some napi-rs packages.

- It works around [npm/cli#4828](https://github.com/npm/cli/issues/4828), where
  `npm` can fail to install the correct platform-specific optional dependency.
- When it has to install a missing binding by itself, it uses the registry,
  credentials and CA settings from the project `.npmrc`, so private registries
  work without extra configuration. The file is read from the project that owns
  the installed package; one that only exists at a workspace root is not picked
  up yet, so keep a `.npmrc` next to that project. If npm itself cannot be
  queried, it warns and uses the public registry, which the two lookups done in
  JavaScript (reading a manifest and downloading a tarball) then fall back to.
- A binding that lives on another filesystem is copied rather than renamed. On
  Node before 16.15 that copy resolves relative symlinks, such as
  `node_modules/.bin` entries, against the source it then removes, so those links
  can break.
- `pnpm` and `yarn` resolve optional dependencies correctly in most cases, so
  the helper is usually a no-op there. Leaving install scripts enabled is the
  safe default.
- If your package manager warns about ignored build scripts, allow the build
  script for the dependency that needs it. For `pnpm` 10+, run
  `pnpm approve-builds`, or add that dependency (for example `unrs-resolver`,
  not `napi-postinstall`) to
  [`ignoredBuiltDependencies`][ignored-built-dependencies] to silence the
  warning when installation already works.
- If the native binding fails to load, re-enable install scripts and reinstall.

### Notes for package authors

Prefer a `postinstall.js` that calls the API instead of invoking the
`napi-postinstall` binary from `postinstall`; see [Postinstall script](#postinstall-script).

If your package runs `napi-postinstall` in `postinstall`, you can copy this note
into your own README:

> This package uses `napi-postinstall` so the correct native binding is
> installed on `npm` versions affected by
> [npm/cli#4828](https://github.com/npm/cli/issues/4828). `pnpm` and `yarn`
> normally handle optional dependencies themselves; if your package manager
> reports ignored build scripts, you can allow the script or safely ignore it
> when the native binding already loads.

### Install

```sh
# pnpm
pnpm add napi-postinstall

# yarn
yarn add napi-postinstall

# npm
npm i napi-postinstall

# bun
bun add napi-postinstall
```

### Postinstall script

Prefer a `postinstall.js` that calls the API over invoking the CLI directly
from `postinstall`. With `npm --no-bin-links`, the bin shim may not exist
([unrs-resolver#190](https://github.com/unrs/unrs-resolver/issues/190)). Use a
JavaScript file that calls the API instead:

```js
// postinstall.js
const { checkAndPreparePackage } = require('napi-postinstall')

checkAndPreparePackage('unrs-resolver').catch(error => {
  console.error(error)
  process.exitCode = 1
})
```

```json
{
  "scripts": {
    "postinstall": "node postinstall.js"
  }
}
```

This will check and prepare the napi binding packages for you automatically.

### CLI

The CLI is available for manual use:

```sh
napi-postinstall unrs-resolver #<napi-package-name>
```

### API

#### Types

```ts
// napi-postinstall
export interface PackageJson {
  name: string
  version: string
}

export declare function checkAndPreparePackage(
  packageNameOrPackageJson: PackageJson | string,
  checkVersion?: boolean,
): Promise<void>

// napi-postinstall/fallback
declare function fallback<T = unknown>(
  packageJsonPath: string,
  checkVersion?: boolean,
): T
export = fallback
```

The installed CLI script is also exposed as `napi-postinstall/cli` for use by the runtime fallback.

#### Example

```js
// index.js
const { checkAndPreparePackage, isNpm } = require('napi-postinstall')

if (isNpm()) {
  void checkAndPreparePackage('unrs-resolver' /* <napi-package-name> */)
}

// fallback.js
module.exports = require('napi-postinstall/fallback')(
  require.resolve('./package.json') /* <napi-package-json-path> */,
  true /* <check-version> */,
)
```

## Sponsors and Backers

[![Sponsors](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

### Sponsors

| 1stG                                                                                                                   | RxTS                                                                                                                   | UnTS                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

### Backers

| 1stG                                                                                                                | RxTS                                                                                                                | UnTS                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[node-install]: https://github.com/evanw/esbuild/blob/4475787eef4c4923b92b9fa37ebba1c88b9e1d9b/lib/npm/node-install.ts
[esbuild]: https://github.com/evanw/esbuild
[napi-rs]: https://github.com/napi-rs/napi-rs
[rollup]: https://github.com/rollup/rollup
[swc-core]: https://github.com/swc-project/swc
[unrs-resolver]: https://github.com/unrs/unrs-resolver
[ignored-built-dependencies]: https://pnpm.io/settings#ignoredbuiltdependencies
[1stG.me]: https://www.1stG.me
[JounQin]: https://github.com/JounQin
[MIT]: http://opensource.org/licenses/MIT
