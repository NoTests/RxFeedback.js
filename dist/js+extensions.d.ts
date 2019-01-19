export declare function unhandledCase(unhandled: never): never;
export declare const canonicalString: (obj: any) => string;
export declare function toArray<T>(original: Set<T>): T[];
export declare function deepEqual(lhs: {}, rhs: {}): boolean;
declare const _default: {
    unhandledCase: typeof unhandledCase;
    canonicalSetValues: <T>(set: Set<T>) => Set<string>;
    canonicalString: (obj: any) => string;
    canonicalDifference: <T>(original: Set<T>, canonical: Set<string>) => Set<T>;
    toArray: typeof toArray;
    deepEqual: typeof deepEqual;
};
export default _default;
