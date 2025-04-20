#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./index.js");
if ((0, index_js_1.isNpm)()) {
    void (0, index_js_1.checkAndPreparePackage)(process.argv[2], ['1', 'check', 'true', 'yes'].includes(process.argv[3]));
}
//# sourceMappingURL=cli.js.map