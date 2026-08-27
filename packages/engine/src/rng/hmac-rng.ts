import { createHmac } from "node:crypto";
const UINT256_RANGE = 1n << 256n;
export function deterministicDie(seed: Uint8Array, campaignId: string, counter: number, dieIndex: number, sides: number): number {
  if (seed.byteLength !== 32) throw new RangeError("seed must be 32 bytes");
  if (!Number.isSafeInteger(counter) || counter < 0 || !Number.isSafeInteger(dieIndex) || dieIndex < 0) throw new RangeError("counter and dieIndex must be nonnegative integers");
  if (!Number.isSafeInteger(sides) || sides < 2) throw new RangeError("sides must be >= 2");
  const modulus = BigInt(sides);
  const limit = UINT256_RANGE - (UINT256_RANGE % modulus);
  for (let rejection = 0; ; rejection += 1) {
    const digest = createHmac("sha256", seed).update(`${campaignId}:${counter}:${dieIndex}:${sides}:${rejection}`).digest("hex");
    const sample = BigInt(`0x${digest}`);
    if (sample < limit) return Number(sample % modulus) + 1;
  }
}
