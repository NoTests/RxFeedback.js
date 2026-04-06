"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalString = void 0;
exports.unhandledCase = unhandledCase;
exports.toArray = toArray;
exports.deepEqual = deepEqual;
function unhandledCase(unhandled) {
    throw unhandled;
}
function orderedStringify(obj) {
    const allKeys = [];
    const distinct = {};
    JSON.stringify(obj, (k, v) => {
        if (distinct[k] === undefined) {
            distinct[k] = true;
            allKeys.push(k);
        }
        return v;
    });
    return JSON.stringify(obj, allKeys.sort());
}
exports.canonicalString = orderedStringify;
function canonicalSetValues(set) {
    const result = new Set();
    set.forEach(value => {
        return result.add((0, exports.canonicalString)(value));
    });
    return result;
}
function canonicalDifference(original, canonical) {
    const result = new Set();
    original.forEach(elem => {
        if (!canonical.has((0, exports.canonicalString)(elem))) {
            result.add(elem);
        }
    });
    return result;
}
function toArray(original) {
    const result = new Array();
    original.forEach(elem => {
        result.push(elem);
    });
    return result;
}
var ObjectKeys = Object.keys;
var ObjectHasOwnProperty = Object.prototype.hasOwnProperty;
function deepEqual(lhs, rhs) {
    if (lhs === rhs) {
        return true;
    }
    if (!(lhs && rhs && typeof lhs == 'object' && typeof rhs == 'object')) {
        return lhs !== lhs && rhs !== rhs;
    }
    const isLhsArray = Array.isArray(lhs), isRhsArray = Array.isArray(rhs);
    if (isLhsArray && isRhsArray) {
        const length = lhs.length;
        if (length != rhs.length) {
            return false;
        }
        for (let i = length; i-- !== 0;)
            if (!deepEqual(lhs[i], rhs[i])) {
                return false;
            }
        return true;
    }
    if (Array.isArray(lhs) != Array.isArray(rhs))
        return false;
    const isLhsDate = lhs instanceof Date, isRhsDate = rhs instanceof Date;
    if (isLhsDate && isRhsDate) {
        return lhs.getTime() == rhs.getTime();
    }
    if (isLhsDate != isRhsDate) {
        return false;
    }
    var isLhsRegexp = lhs instanceof RegExp, isRhsRegexp = rhs instanceof RegExp;
    if (isLhsRegexp != isRhsRegexp)
        return false;
    if (isLhsRegexp && isRhsRegexp)
        return lhs.toString() == rhs.toString();
    var keys = ObjectKeys(lhs);
    const length = keys.length;
    if (length !== ObjectKeys(rhs).length)
        return false;
    for (let i = length; i-- !== 0;)
        if (!ObjectHasOwnProperty.call(rhs, keys[i]))
            return false;
    for (let i = length; i-- !== 0;) {
        let key = keys[i];
        if (!deepEqual(lhs[key], rhs[key]))
            return false;
    }
    return true;
}
;
exports.default = {
    unhandledCase,
    canonicalSetValues,
    canonicalString: exports.canonicalString,
    canonicalDifference,
    toArray,
    deepEqual
};
//# sourceMappingURL=js+extensions.js.map