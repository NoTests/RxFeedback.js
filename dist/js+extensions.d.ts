export declare function unhandledCase(unhandled: never): never;
declare function orderedStringify(obj: any): string;
export declare const canonicalString: typeof orderedStringify;
declare function canonicalSetValues<T>(set: Set<T>): Set<string>;
declare function canonicalDifference<T>(original: Set<T>, canonical: Set<string>): Set<T>;
export declare function toArray<T>(original: Set<T>): T[];
export declare function deepEqual(lhs: {}, rhs: {}): boolean;
declare const _default: {
    unhandledCase: typeof unhandledCase;
    canonicalSetValues: typeof canonicalSetValues;
    canonicalString: typeof orderedStringify;
    canonicalDifference: typeof canonicalDifference;
    toArray: typeof toArray;
    deepEqual: typeof deepEqual;
};
export default _default;
