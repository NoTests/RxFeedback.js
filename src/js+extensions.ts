export function unhandledCase(unhandled: never): never {
  throw unhandled;
}

function orderedStringify(obj: any) { 
  const allKeys: string[] = []; 
  const distinct = { };
  JSON.stringify(obj, (k, v) => { 
    if (distinct[k] === undefined) {
      distinct[k] = true;
      allKeys.push(k); 
    }
    return v; 
  }); 
  return JSON.stringify(obj, allKeys.sort()); 
}

export const canonicalString = orderedStringify;

function canonicalSetValues<T>(set: Set<T>): Set<string> {
  const result = new Set<string>();
  set.forEach(value => {
    return result.add(canonicalString(value));
  });

  return result;
}

function canonicalDifference<T>(
  original: Set<T>,
  canonical: Set<string>
): Set<T> {
  const result = new Set<T>();
  original.forEach(elem => {
    if (!canonical.has(canonicalString(elem))) {
      result.add(elem);
    }
  });

  return result;
}

export function toArray<T>(original: Set<T>): T[] {
  const result = new Array<T>();
  original.forEach(elem => {
    result.push(elem);
  });

  return result;
}

var ObjectKeys = Object.keys;
var ObjectHasOwnProperty = Object.prototype.hasOwnProperty;

export function deepEqual(lhs: {}, rhs: {}) {
  if (lhs === rhs) { return true; }

  if (!(lhs && rhs && typeof lhs == 'object' && typeof rhs == 'object')) {
    return lhs !== lhs && rhs !== rhs;
  }

  const isLhsArray = Array.isArray(lhs), isRhsArray = Array.isArray(rhs);
  if (isLhsArray && isRhsArray) {
    const length = (lhs as {}[]).length;
    if (length != (rhs as {}[]).length) { return false }
    for (let i = length; i-- !== 0;)
      if (!deepEqual(lhs[i], rhs[i])) { return false }
    return true;
  }

  if (Array.isArray(lhs) != Array.isArray(rhs)) return false;

  const isLhsDate = lhs instanceof Date, isRhsDate = rhs instanceof Date;
  if (isLhsDate && isRhsDate) { return (lhs as Date).getTime() == (rhs as Date).getTime(); }
  if (isLhsDate != isRhsDate) { return false; }

  var isLhsRegexp = lhs instanceof RegExp, isRhsRegexp = rhs instanceof RegExp;
  if (isLhsRegexp != isRhsRegexp) return false;
  if (isLhsRegexp && isRhsRegexp) return lhs.toString() == rhs.toString();

  var keys = ObjectKeys(lhs);
  const length = keys.length;

  if (length !== ObjectKeys(rhs).length)
    return false;

  for (let i = length; i-- !== 0;)
    if (!ObjectHasOwnProperty.call(rhs, keys[i])) return false;

  for (let i = length; i-- !== 0;) {
    let key = keys[i];
    if (!deepEqual(lhs[key], rhs[key])) return false;
  }

  return true;
};

export default {
  unhandledCase,
  canonicalSetValues,
  canonicalString,
  canonicalDifference,
  toArray,
  deepEqual
};
