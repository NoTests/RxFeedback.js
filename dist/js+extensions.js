"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function unhandledCase(unhandled) {
    throw unhandled;
}
exports.unhandledCase = unhandledCase;
function orderedStringify(obj) {
    var allKeys = [];
    var distinct = {};
    JSON.stringify(obj, function (k, v) {
        if (distinct[k] === undefined) {
            distinct[k] = true;
            allKeys.push(k);
        }
        return v;
    });
    return JSON.stringify(obj, allKeys.sort());
}
var canonicalString = orderedStringify;
function canonicalSetValues(set) {
    var result = new Set();
    set.forEach(function (value) {
        return result.add(canonicalString(value));
    });
    return result;
}
function canonicalDifference(original, canonical) {
    var result = new Set();
    original.forEach(function (elem) {
        if (!canonical.has(canonicalString(elem))) {
            result.add(elem);
        }
    });
    return result;
}
function toArray(original) {
    var result = new Array();
    original.forEach(function (elem) {
        result.push(elem);
    });
    return result;
}
exports.toArray = toArray;
exports.default = {
    unhandledCase: unhandledCase,
    canonicalSetValues: canonicalSetValues,
    canonicalString: canonicalString,
    canonicalDifference: canonicalDifference,
    toArray: toArray
};
//# sourceMappingURL=js+extensions.js.map