export declare class KeyedMutex {
    private readonly tails;
    run<T>(key: string, action: () => Promise<T>): Promise<T>;
}
//# sourceMappingURL=mutex.d.ts.map