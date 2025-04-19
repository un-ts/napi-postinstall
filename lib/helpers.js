"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalNpmRegistry = getGlobalNpmRegistry;
exports.removeRecursive = removeRecursive;
exports.downloadedNodePath = downloadedNodePath;
exports.getNapiInfoFromPackageJson = getNapiInfoFromPackageJson;
exports.getNapiNativeTarget = getNapiNativeTarget;
exports.getNapiNativeTargets = getNapiNativeTargets;
exports.getErrorMessage = getErrorMessage;
const tslib_1 = require("tslib");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = tslib_1.__importDefault(require("node:fs"));
const node_path_1 = tslib_1.__importDefault(require("node:path"));
const constants_js_1 = require("./constants.js");
const target_js_1 = require("./target.js");
function getGlobalNpmRegistry() {
    try {
        const registry = (0, node_child_process_1.execSync)('npm config get registry', {
            encoding: 'utf8',
        }).trim();
        return registry.endsWith('/') ? registry : `${registry}/`;
    }
    catch (_a) {
        return constants_js_1.DEFAULT_NPM_REGISTRY;
    }
}
function removeRecursive(dir) {
    for (const entry of node_fs_1.default.readdirSync(dir)) {
        const entryPath = node_path_1.default.join(dir, entry);
        let stats;
        try {
            stats = node_fs_1.default.lstatSync(entryPath);
        }
        catch (_a) {
            continue;
        }
        if (stats.isDirectory()) {
            removeRecursive(entryPath);
        }
        else {
            node_fs_1.default.unlinkSync(entryPath);
        }
    }
    node_fs_1.default.rmdirSync(dir);
}
function downloadedNodePath(name, subpath) {
    const pkgLibDir = node_path_1.default.dirname(require.resolve(name + '/package.json'));
    return node_path_1.default.join(pkgLibDir, `${node_path_1.default.basename(subpath)}`);
}
function getNapiInfoFromPackageJson(packageJson, checkVersion) {
    var _a, _b, _c, _d, _e, _f;
    const { name, napi: napi_, optionalDependencies } = packageJson;
    const targets = (_a = napi_ === null || napi_ === void 0 ? void 0 : napi_.targets) !== null && _a !== void 0 ? _a : (_b = napi_ === null || napi_ === void 0 ? void 0 : napi_.triples) === null || _b === void 0 ? void 0 : _b.additional;
    if (!(targets === null || targets === void 0 ? void 0 : targets.length) || !optionalDependencies) {
        throw new Error(`No \`napi.targets\` nor \`optionalDependencies\` field found in \`${name}\`'s \`package.json\`. Please ensure the package is built with NAPI support.`);
    }
    const napi = napi_;
    napi.targets = targets;
    let version;
    for (const target of targets) {
        const { platformArchABI } = (0, target_js_1.parseTriple)(target);
        (_c = napi.binaryName) !== null && _c !== void 0 ? _c : (napi.binaryName = napi.name);
        (_d = napi.packageName) !== null && _d !== void 0 ? _d : (napi.packageName = (_f = (_e = napi.package) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : name);
        const pkg = `${napi.packageName}-${platformArchABI}`;
        const packageVersion = optionalDependencies[pkg];
        if (checkVersion && !packageVersion) {
            throw new Error(`No version found for \`${name}\` with \`${pkg}\`.`);
        }
        if (version) {
            if (version !== packageVersion) {
                throw new Error(`Inconsistent package versions found for \`${name}\` with \`${pkg}\` v${packageVersion} vs v${version}.`);
            }
        }
        else if (packageVersion) {
            version = packageVersion;
            if (!checkVersion) {
                break;
            }
        }
    }
    return { napi, version };
}
function isMusl() {
    let musl = false;
    if (process.platform === 'linux') {
        musl = isMuslFromFilesystem();
        if (musl === null) {
            musl = isMuslFromReport();
        }
        if (musl === null) {
            musl = isMuslFromChildProcess();
        }
    }
    return musl;
}
const isFileMusl = (f) => f.includes('libc.musl-') || f.includes('ld-musl-');
function isMuslFromFilesystem() {
    try {
        return node_fs_1.default.readFileSync('/usr/bin/ldd', 'utf8').includes('musl');
    }
    catch (_a) {
        return null;
    }
}
function isMuslFromReport() {
    let report = null;
    if (typeof process.report.getReport === 'function') {
        process.report.excludeNetwork = true;
        report = process.report.getReport();
    }
    if (!report) {
        return null;
    }
    if ('header' in report &&
        report.header != null &&
        typeof report.header === 'object' &&
        'glibcVersionRuntime' in report.header &&
        report.header.glibcVersionRuntime) {
        return false;
    }
    return ('sharedObjects' in report &&
        Array.isArray(report.sharedObjects) &&
        report.sharedObjects.some(isFileMusl));
}
function isMuslFromChildProcess() {
    try {
        return (0, node_child_process_1.execSync)('ldd --version', { encoding: 'utf8' }).includes('musl');
    }
    catch (_a) {
        return false;
    }
}
function getNapiNativeTarget() {
    switch (process.platform) {
        case 'android': {
            if (process.arch === 'arm64') {
                return 'android-arm64';
            }
            if (process.arch === 'arm') {
                return 'android-arm-eabi';
            }
            break;
        }
        case 'win32': {
            if (process.arch === 'x64') {
                return 'win32-x64-msvc';
            }
            if (process.arch === 'ia32') {
                return 'win32-ia32-msvc';
            }
            if (process.arch === 'arm64') {
                return 'win32-arm64-msvc';
            }
            break;
        }
        case 'darwin': {
            const targets = ['darwin-universal'];
            if (process.arch === 'x64') {
                targets.push('darwin-x64');
            }
            else if (process.arch === 'arm64') {
                targets.push('darwin-arm64');
            }
            return targets;
        }
        case 'freebsd': {
            if (process.arch === 'x64') {
                return 'freebsd-x64';
            }
            if (process.arch === 'arm64') {
                return 'freebsd-arm64';
            }
            break;
        }
        case 'linux': {
            if (process.arch === 'x64') {
                if (isMusl()) {
                    return 'linux-x64-musl';
                }
                return 'linux-x64-gnu';
            }
            if (process.arch === 'arm64') {
                if (isMusl()) {
                    return 'linux-arm64-musl';
                }
                return 'linux-arm64-gnu';
            }
            if (process.arch === 'arm') {
                if (isMusl()) {
                    return 'linux-arm-musleabihf';
                }
                return 'linux-arm-gnueabihf';
            }
            if (process.arch === 'riscv64') {
                if (isMusl()) {
                    return 'linux-riscv64-musl';
                }
                return 'linux-riscv64-gnu';
            }
            if (process.arch === 'ppc64') {
                return 'linux-ppc64-gnu';
            }
            if (process.arch === 's390x') {
                return 'linux-s390x-gnu';
            }
            break;
        }
    }
    return [];
}
const WASI_TARGET = 'wasm32-wasi';
function getNapiNativeTargets() {
    const targets = getNapiNativeTarget();
    if (Array.isArray(targets)) {
        return [...targets, WASI_TARGET];
    }
    return [targets, WASI_TARGET];
}
function getErrorMessage(err) {
    return (err === null || err === void 0 ? void 0 : err.message) || String(err);
}
//# sourceMappingURL=helpers.js.map