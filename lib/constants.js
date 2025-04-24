"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_JSON = exports.EABI = exports.WASM32_WASI = exports.WASI = exports.WASM32 = exports.LOG_PREFIX = exports.version = exports.name = exports.DEFAULT_NPM_REGISTRY = void 0;
const path = require("node:path");
exports.DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/';
_a = require(path.resolve(__dirname, '../package.json')), exports.name = _a.name, exports.version = _a.version;
exports.LOG_PREFIX = `[${exports.name}@${exports.version}] `;
exports.WASM32 = 'wasm32';
exports.WASI = 'wasi';
exports.WASM32_WASI = `${exports.WASM32}-${exports.WASI}`;
exports.EABI = 'eabi';
exports.PACKAGE_JSON = 'package.json';
//# sourceMappingURL=constants.js.map