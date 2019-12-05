export function definedOf<T>(...items: (T | undefined)[]): T[] {
    return items.filter((i) => i !== undefined).map((i) => i!);
}

export function partition<T, K>(items: T[], fn: (item: T) => K): Map<K, T[] | undefined> {
    const partition = new Map<K, T[] | undefined>();
    for (const item of items) {
        const key = fn(item);
        if (!partition.get(key)) {
            partition.set(key, Array.of<T>());
        }
        partition.get(key)!.push(item);
    }
    return partition;
}
