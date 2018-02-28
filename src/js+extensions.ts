export function unhandledCase(unhandled: never): never {
    throw unhandled;
}

// tslint:disable-next-line
function canonicalPrimitiveSegments(value: any): [string] | null {
    if (value === null) { return ['n']; }
    if (value === undefined) { return ['u']; }
    if (typeof(value) === 'boolean') { return [value ? 't' : 'f']; }
    if (typeof(value) === 'string') { return [value.replace(/\\/g, '\\\\').replace(/\"/g, '\\\"')]; }
    if (typeof(value) === 'number') { return [value.toString()]; }

    return null;
}

// tslint:disable-next-line
function canonicalSegments(value: any): string[] {
    const primitiveResult = canonicalPrimitiveSegments(value);

    if (primitiveResult != null) {
        return primitiveResult;
    }

    if (typeof(value) === 'function') { throw 'Functions can\'t be serialized'; }
    if (typeof(value) !== 'object') { throw 'Unknown object'; }


    let result = ['{'];
    if (Array.isArray(value)) {
        for (let i = 0; i < result.length; ++i) {
            result.push(i.toString());
            const serializedValue = canonicalPrimitiveSegments(+value[i]);
            if (serializedValue == null) {
                throw 'Unknown value ' + value[i];
            }
            result.push(...serializedValue); 
        }
    }
    else {
        let allKeys: string[] = [];
        for (const key in value) {
            if (value.hasOwnProperty(key)) {
                allKeys.push(key);
            }
        }
        allKeys.sort();
        allKeys.forEach(key => { 
            result.push(key);
            const serializedValue = canonicalPrimitiveSegments(value[key]);
            if (serializedValue == null) {
                throw 'Unknown value ' + value[key];
            }
            result.push(...serializedValue); 
        });
    }
    result.push('}');
    return result;
}

// tslint:disable-next-line
function canonicalString(value: any): String {
    return canonicalSegments(value).join(',');
}

function canonicalSetValues<T>(set: Set<T>): Set<String> {
    const result = new Set<String>();
    set.forEach(value => { 
        return result.add(canonicalString(value));
    });

    return result;
}

function canonicalDifference<T>(original: Set<T>, canonical: Set<String>): Set<T> {
    const result = new Set<T>();
    original.forEach((elem) => {
        if (!canonical.has(canonicalString(elem))) {
            result.add(elem);
        }
    });

    return result;
}

export function toArray<T>(original: Set<T>): T[] {
    const result = new Array<T>();
    original.forEach((elem) => {
        result.push(elem);
    });

    return result;
}

export default { unhandledCase, canonicalString, canonicalSetValues, canonicalDifference, toArray };