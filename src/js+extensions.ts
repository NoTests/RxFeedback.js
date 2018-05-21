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

const canonicalString = orderedStringify;

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

export default {
  unhandledCase,
  canonicalSetValues,
  canonicalString,
  canonicalDifference,
  toArray
};
