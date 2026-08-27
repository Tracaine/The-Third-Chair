export interface ServerConfig { readonly port: number; readonly host: string; readonly fakeMode: boolean; }
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("INVALID_PORT");
  return { port, host: env.THIRD_CHAIR_HOST ?? "127.0.0.1", fakeMode: env.THIRD_CHAIR_FAKE_MODE === "1" };
}
