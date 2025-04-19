"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_PREFIX = exports.version = exports.name = exports.DEFAULT_NPM_REGISTRY = void 0;
const tslib_1 = require("tslib");
const node_path_1 = tslib_1.__importDefault(require("node:path"));
exports.DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/';
_a = require(node_path_1.default.resolve(__dirname, '../package.json')), exports.name = _a.name, exports.version = _a.version;
exports.LOG_PREFIX = `[${exports.name}@${exports.version}] `;
//# sourceMappingURL=constants.js.map