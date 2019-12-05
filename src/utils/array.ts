export function definedOf<T>(...items: (T | undefined)[]): T[] {
    return items.filter((i) => i !== undefined).map((i) => i!);
}

export function partition<T>(items: T[], fn: (item: T) => boolean): Partition<T> {
    const matches = Array.of<T>();
    const nonMatches = Array.of<T>();
    for (const item of items) {
        if (fn(item)) {
            matches.push(item);
        } else {
            nonMatches.push(item);
        }
    }
    return { matches, nonMatches };
}

export interface Partition<T> {
    readonly matches: ReadonlyArray<T>;
    readonly nonMatches: ReadonlyArray<T>;
}
