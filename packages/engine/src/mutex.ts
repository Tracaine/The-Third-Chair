export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();
  async run<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => { release = resolve; });
    this.tails.set(key, previous.then(() => mine));
    await previous;
    try { return await action(); } finally { release(); if (this.tails.get(key) === mine) this.tails.delete(key); }
  }
}
