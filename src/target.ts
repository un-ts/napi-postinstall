// based on https://github.com/napi-rs/napi-rs/blob/2eb2ab619f9fb924453e21d2198fe67ea21b9680/cli/src/utils/target.ts

import { EABI, WASI, WASM32, WASM32_WASI } from './constants.js'
import type { NodeJSArch, Platform, Target } from './types.js'

const CpuToNodeArch: Record<string, NodeJSArch> = {
  x86_64: 'x64',
  aarch64: 'arm64',
  i686: 'ia32',
  armv7: 'arm',
  loongarch64: 'loong64',
  riscv64gc: 'riscv64',
  powerpc64le: 'ppc64',
}

const SysToNodePlatform: Record<string, Platform> = {
  linux: 'linux',
  freebsd: 'freebsd',
  darwin: 'darwin',
  windows: 'win32',
  ohos: 'openharmony',
}

const SUB_SYSTEMS = new Set(['android', 'ohos'])

/**
 * A triple is a specific format for specifying a target architecture.
 * Triples may be referred to as a target triple which is the architecture for the artifact produced, and the host triple which is the architecture that the compiler is running on.
 * The general format of the triple is `<arch><sub>-<vendor>-<sys>-<abi>` where:
 *   - `arch` = The base CPU architecture, for example `x86_64`, `i686`, `arm`, `thumb`, `mips`, etc.
 *   - `sub` = The CPU sub-architecture, for example `arm` has `v7`, `v7s`, `v5te`, etc.
 *   - `vendor` = The vendor, for example `unknown`, `apple`, `pc`, `nvidia`, etc.
 *   - `sys` = The system name, for example `linux`, `windows`, `darwin`, etc. none is typically used for bare-metal without an OS.
 *   - `abi` = The ABI, for example `gnu`, `android`, `eabi`, etc.
 */
export function parseTriple(rawTriple: string): Target {
  if (
    rawTriple === WASM32_WASI ||
    rawTriple === `${WASM32_WASI}-preview1-threads` ||
    rawTriple.startsWith(`${WASM32}-${WASI}p`)
  ) {
    return {
      triple: rawTriple,
      platformArchABI: WASM32_WASI,
      platform: WASI,
      arch: WASM32,
      abi: WASI,
    }
  }
  const triple = rawTriple.endsWith(EABI)
    ? `${rawTriple.slice(0, -4)}-${EABI}`
    : rawTriple
  const triples = triple.split('-')
  let cpu: string
  let sys: string
  let abi: string | null = null
  if (triples.length === 2) {
    // aarch64-fuchsia
    // ^ cpu   ^ sys
    ;[cpu, sys] = triples
  } else {
    // aarch64-unknown-linux-musl
    // ^ cpu   ^vendor ^ sys ^ abi
    // aarch64-apple-darwin
    // ^ cpu         ^ sys  (abi is None)
    ;[cpu, , sys, abi = null] = triples
  }

  if (abi && SUB_SYSTEMS.has(abi)) {
    sys = abi
    // eslint-disable-next-line sonarjs/no-redundant-assignments
    abi = null
  }
  const platform = SysToNodePlatform[sys] ?? (sys as Platform)
  const arch = CpuToNodeArch[cpu] ?? (cpu as NodeJSArch)

  return {
    triple: rawTriple,
    platformArchABI: abi ? `${platform}-${arch}-${abi}` : `${platform}-${arch}`,
    platform,
    arch,
    abi,
  }
}
