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
exports.canonicalString = orderedStringify;
function canonicalSetValues(set) {
    var result = new Set();
    set.forEach(function (value) {
        return result.add(exports.canonicalString(value));
    });
    return result;
}
function canonicalDifference(original, canonical) {
    var result = new Set();
    original.forEach(function (elem) {
        if (!canonical.has(exports.canonicalString(elem))) {
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
var ObjectKeys = Object.keys;
var ObjectHasOwnProperty = Object.prototype.hasOwnProperty;
function deepEqual(lhs, rhs) {
    if (lhs === rhs) {
        return true;
    }
    if (!(lhs && rhs && typeof lhs == 'object' && typeof rhs == 'object')) {
        return lhs !== lhs && rhs !== rhs;
    }
    var isLhsArray = Array.isArray(lhs), isRhsArray = Array.isArray(rhs);
    if (isLhsArray && isRhsArray) {
        var length_1 = lhs.length;
        if (length_1 != rhs.length) {
            return false;
        }
        for (var i = length_1; i-- !== 0;)
            if (!deepEqual(lhs[i], rhs[i])) {
                return false;
            }
        return true;
    }
    if (Array.isArray(lhs) != Array.isArray(rhs))
        return false;
    var isLhsDate = lhs instanceof Date, isRhsDate = rhs instanceof Date;
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
    var length = keys.length;
    if (length !== ObjectKeys(rhs).length)
        return false;
    for (var i = length; i-- !== 0;)
        if (!ObjectHasOwnProperty.call(rhs, keys[i]))
            return false;
    for (var i = length; i-- !== 0;) {
        var key = keys[i];
        if (!deepEqual(lhs[key], rhs[key]))
            return false;
    }
    return true;
}
exports.deepEqual = deepEqual;
;
exports.default = {
    unhandledCase: unhandledCase,
    canonicalSetValues: canonicalSetValues,
    canonicalString: exports.canonicalString,
    canonicalDifference: canonicalDifference,
    toArray: toArray,
    deepEqual: deepEqual
};
//# sourceMappingURL=js+extensions.js.map