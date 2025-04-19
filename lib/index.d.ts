import type { PackageJson } from './types.js';
export type * from './target.js';
export type * from './types.js';
export declare function checkAndPreparePackage(packageNameOrPackageJson: PackageJson | string, checkVersion?: boolean): Promise<void>;
