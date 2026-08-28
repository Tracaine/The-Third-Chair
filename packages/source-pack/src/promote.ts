import { access, rename, rm } from "node:fs/promises";

async function exists(path: string): Promise<boolean> { try { await access(path); return true; } catch { return false; } }

export async function promoteSourcePack(pendingPath: string, destination: string): Promise<void> {
  const previous = `${destination}.previous`; const hadDestination = await exists(destination);
  if (hadDestination) {
    await rm(previous, { force: true });
    await rename(destination, previous);
  }
  try { await rename(pendingPath, destination); }
  catch (error) {
    if (hadDestination && await exists(previous) && !await exists(destination)) await rename(previous, destination);
    throw error;
  }
}
