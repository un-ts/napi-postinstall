export interface Napi {
    binaryName?: string;
    name?: string;
    packageName?: string;
    package?: {
        name: string;
    };
    targets?: string[];
    triples?: {
        defaults?: boolean;
        additional?: string[];
    };
    wasm?: {
        browser?: {
            fs?: boolean;
        };
    };
}
export interface NapiInfo {
    napi: Napi;
    version?: string;
}
export interface PackageJson {
    name: string;
    version: string;
    optionalDependencies?: Partial<Record<string, string>>;
    napi?: Napi;
}
