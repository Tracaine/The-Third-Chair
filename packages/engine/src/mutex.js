export class KeyedMutex {
    tails = new Map();
    async run(key, action) {
        const previous = this.tails.get(key) ?? Promise.resolve();
        let release;
        const mine = new Promise((resolve) => { release = resolve; });
        this.tails.set(key, previous.then(() => mine));
        await previous;
        try {
            return await action();
        }
        finally {
            release();
            if (this.tails.get(key) === mine)
                this.tails.delete(key);
        }
    }
}
//# sourceMappingURL=mutex.js.map