import type { PackageJson } from './types.js';
export type * from './types.js';
export declare function isNpm(): boolean;
export declare function checkAndPreparePackage(packageNameOrPackageJson: PackageJson | string, checkVersion?: boolean): Promise<void>;
