"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndPreparePackage = checkAndPreparePackage;
const tslib_1 = require("tslib");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = tslib_1.__importDefault(require("node:fs"));
const node_https_1 = tslib_1.__importDefault(require("node:https"));
const node_path_1 = tslib_1.__importDefault(require("node:path"));
const node_zlib_1 = tslib_1.__importDefault(require("node:zlib"));
const constants_js_1 = require("./constants.js");
const helpers_js_1 = require("./helpers.js");
function fetch(url) {
    return new Promise((resolve, reject) => {
        node_https_1.default
            .get(url, res => {
            if ((res.statusCode === 301 || res.statusCode === 302) &&
                res.headers.location) {
                fetch(res.headers.location).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Server responded with ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        })
            .on('error', reject);
    });
}
function extractFileFromTarGzip(buffer, subpath) {
    try {
        buffer = node_zlib_1.default.unzipSync(buffer);
    }
    catch (err) {
        throw new Error(`Invalid gzip data in archive: ${(err === null || err === void 0 ? void 0 : err.message) || String(err)}`);
    }
    const str = (i, n) => String.fromCodePoint(...buffer.subarray(i, i + n)).replace(/\0.*$/, '');
    let offset = 0;
    subpath = `package/${subpath}`;
    while (offset < buffer.length) {
        const name = str(offset, 100);
        const size = Number.parseInt(str(offset + 124, 12), 8);
        offset += 512;
        if (!Number.isNaN(size)) {
            if (name === subpath) {
                return buffer.subarray(offset, offset + size);
            }
            offset += (size + 511) & ~511;
        }
    }
    throw new Error(`Could not find ${JSON.stringify(subpath)} in archive`);
}
function isNpm() {
    const { npm_config_user_agent } = process.env;
    if (npm_config_user_agent) {
        return /\bnpm\//.test(npm_config_user_agent);
    }
    return false;
}
function installUsingNPM(hostPkg, pkg, version, subpath, nodePath) {
    const env = Object.assign(Object.assign({}, process.env), { npm_config_global: undefined });
    const pkgDir = node_path_1.default.dirname(require.resolve(hostPkg + '/package.json'));
    const installDir = node_path_1.default.join(pkgDir, 'npm-install');
    node_fs_1.default.mkdirSync(installDir, { recursive: true });
    try {
        node_fs_1.default.writeFileSync(node_path_1.default.join(installDir, 'package.json'), '{}');
        (0, node_child_process_1.execSync)(`npm install --loglevel=error --prefer-offline --no-audit --progress=false ${pkg}@${version}`, { cwd: installDir, stdio: 'pipe', env });
        try {
            const newPath = node_path_1.default.resolve(pkgDir, hostPkg
                .split('/')
                .map(() => '..')
                .join('/'), pkg);
            node_fs_1.default.mkdirSync(newPath, { recursive: true });
            node_fs_1.default.renameSync(node_path_1.default.join(installDir, 'node_modules', pkg), newPath);
        }
        catch (_a) {
            node_fs_1.default.renameSync(node_path_1.default.join(installDir, 'node_modules', pkg, subpath), nodePath);
        }
    }
    finally {
        try {
            (0, helpers_js_1.removeRecursive)(installDir);
        }
        catch (_b) {
        }
    }
}
function downloadDirectlyFromNPM(pkg, version, subpath, nodePath) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const url = `${(0, helpers_js_1.getGlobalNpmRegistry)()}${pkg}/-/${pkg.startsWith('@') ? pkg.split('/')[1] : pkg}-${version}.tgz`;
        console.error(`${constants_js_1.LOG_PREFIX}Trying to download ${JSON.stringify(url)}`);
        try {
            node_fs_1.default.writeFileSync(nodePath, extractFileFromTarGzip(yield fetch(url), subpath));
        }
        catch (err) {
            console.error(`${constants_js_1.LOG_PREFIX}Failed to download ${JSON.stringify(url)}: ${(0, helpers_js_1.getErrorMessage)(err)}`);
            throw err;
        }
    });
}
function checkAndPreparePackage(packageNameOrPackageJson, checkVersion) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const packageJson = typeof packageNameOrPackageJson === 'string'
            ? require(packageNameOrPackageJson + '/package.json')
            : packageNameOrPackageJson;
        const { name, version, optionalDependencies } = packageJson;
        const { napi, version: napiVersion = version } = (0, helpers_js_1.getNapiInfoFromPackageJson)(packageJson, checkVersion);
        if (checkVersion && version !== napiVersion) {
            throw new Error(`Inconsistent package versions found for \`${name}\` v${version} vs \`${napi.packageName}\` v${napiVersion}.`);
        }
        const targets = (0, helpers_js_1.getNapiNativeTargets)();
        for (const target of targets) {
            const pkg = `${napi.packageName}-${target}`;
            if (!(optionalDependencies === null || optionalDependencies === void 0 ? void 0 : optionalDependencies[pkg])) {
                continue;
            }
            const binaryPrefix = napi.binaryName ? `${napi.binaryName}.` : '';
            const subpath = `${binaryPrefix}${target}.node`;
            try {
                require.resolve(`${pkg}/${subpath}`);
                break;
            }
            catch (_a) {
                if (!isNpm()) {
                    console.error(`${constants_js_1.LOG_PREFIX}Failed to find package "${pkg}" on the file system

This can happen if you use the "--no-optional" flag. The "optionalDependencies"
package.json feature is used by ${name} to install the correct napi binary
for your current platform. This install script will now attempt to work around
this. If that fails, you need to remove the "--no-optional" flag to use ${name}.
`);
                }
                const nodePath = (0, helpers_js_1.downloadedNodePath)(name, subpath);
                try {
                    console.error(`${constants_js_1.LOG_PREFIX}Trying to install package "${pkg}" using npm`);
                    installUsingNPM(name, pkg, napiVersion, subpath, nodePath);
                    break;
                }
                catch (err) {
                    console.error(`${constants_js_1.LOG_PREFIX}Failed to install package "${pkg}" using npm: ${(0, helpers_js_1.getErrorMessage)(err)}`);
                    try {
                        yield downloadDirectlyFromNPM(pkg, napiVersion, subpath, nodePath);
                        break;
                    }
                    catch (err) {
                        throw new Error(`Failed to install package "${pkg}": ${(0, helpers_js_1.getErrorMessage)(err)}`);
                    }
                }
            }
        }
    });
}
//# sourceMappingURL=index.js.map