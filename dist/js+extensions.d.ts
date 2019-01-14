export declare function unhandledCase(unhandled: never): never;
export declare function toArray<T>(original: Set<T>): T[];
declare const _default: {
    unhandledCase: typeof unhandledCase;
    canonicalSetValues: <T>(set: Set<T>) => Set<string>;
    canonicalString: (obj: any) => string;
    canonicalDifference: <T>(original: Set<T>, canonical: Set<string>) => Set<T>;
    toArray: typeof toArray;
};
export default _default;