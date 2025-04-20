"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTriple = parseTriple;
const CpuToNodeArch = {
    x86_64: 'x64',
    aarch64: 'arm64',
    i686: 'ia32',
    armv7: 'arm',
    riscv64gc: 'riscv64',
    powerpc64le: 'ppc64',
};
const SysToNodePlatform = {
    linux: 'linux',
    freebsd: 'freebsd',
    darwin: 'darwin',
    windows: 'win32',
};
function parseTriple(rawTriple) {
    if (rawTriple === 'wasm32-wasi' ||
        rawTriple === 'wasm32-wasi-preview1-threads' ||
        rawTriple.startsWith('wasm32-wasip')) {
        return {
            triple: rawTriple,
            platformArchABI: 'wasm32-wasi',
            platform: 'wasi',
            arch: 'wasm32',
            abi: 'wasi',
        };
    }
    const triple = rawTriple.endsWith('eabi')
        ? `${rawTriple.slice(0, -4)}-eabi`
        : rawTriple;
    const triples = triple.split('-');
    let cpu;
    let sys;
    let abi = null;
    if (triples.length === 2) {
        ;
        [cpu, sys] = triples;
    }
    else {
        ;
        [cpu, , sys, abi = null] = triples;
    }
    const platform = SysToNodePlatform[sys] ?? sys;
    const arch = CpuToNodeArch[cpu] ?? cpu;
    return {
        triple: rawTriple,
        platformArchABI: abi ? `${platform}-${arch}-${abi}` : `${platform}-${arch}`,
        platform,
        arch,
        abi,
    };
}
//# sourceMappingURL=target.js.map