export type Platform = NodeJS.Platform | 'wasi' | 'wasm';
export type NodeJSArch = NodeJS.Architecture | 'universal' | 'wasm32' | 'x32';
export interface Target {
    triple: string;
    platformArchABI: string;
    platform: Platform;
    arch: NodeJSArch;
    abi: string | null;
}
export declare function parseTriple(rawTriple: string): Target;
