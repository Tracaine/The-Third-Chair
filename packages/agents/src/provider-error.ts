export type ProviderRole = "DIRECTOR" | "NARRATOR";

interface SafeProviderMetadata {
  readonly status?: number;
  readonly code?: string;
  readonly type?: string;
  readonly name?: string;
}

function safeMetadata(error: unknown): SafeProviderMetadata[] {
  const metadata: SafeProviderMetadata[] = [];
  const seen = new Set<object>();
  let current = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    const value = current as Record<string, unknown>;
    metadata.push({
      ...(typeof value.status === "number" ? { status: value.status } : {}),
      ...(typeof value.code === "string" ? { code: value.code.toLowerCase() } : {}),
      ...(typeof value.type === "string" ? { type: value.type.toLowerCase() } : {}),
      ...(typeof value.name === "string" ? { name: value.name } : {}),
    });
    current = value.cause;
  }
  return metadata;
}

export function classifyProviderError(
  error: unknown,
  role: ProviderRole,
  fallback = `${role}_RUN_FAILED`,
): string {
  const metadata = safeMetadata(error);
  const hasCode = (...codes: string[]) => metadata.some(({ code, type }) =>
    (code !== undefined && codes.includes(code)) || (type !== undefined && codes.includes(type)));
  const hasStatus = (status: number) => metadata.some((item) => item.status === status);
  const hasName = (...names: string[]) => metadata.some(({ name }) => name !== undefined && names.includes(name));

  if (hasCode("insufficient_quota", "billing_hard_limit_reached")) return `${role}_QUOTA_EXHAUSTED`;
  if (hasStatus(401) || hasCode("invalid_api_key")) return `${role}_AUTHENTICATION_FAILED`;
  if (hasCode("model_not_found")) return `${role}_MODEL_UNAVAILABLE`;
  if (hasStatus(403)) return `${role}_ACCESS_DENIED`;
  if (hasStatus(429)) return `${role}_RATE_LIMITED`;
  if (hasName("APIConnectionTimeoutError")) return `${role}_TRANSPORT_TIMEOUT`;
  if (hasName("APIConnectionError") || hasCode("econnrefused", "econnreset", "enotfound", "etimedout")) {
    return `${role}_TRANSPORT_FAILED`;
  }
  if (metadata.some(({ status }) => status !== undefined && status >= 500)) return `${role}_PROVIDER_UNAVAILABLE`;
  if (hasStatus(400) || hasStatus(404) || hasStatus(422)) return `${role}_REQUEST_REJECTED`;
  if (hasName("UserError")) return `${role}_SDK_CONFIGURATION_FAILED`;
  if (hasName("ModelBehaviorError")) return `${role}_MODEL_BEHAVIOR_FAILED`;
  if (hasName("MaxTurnsExceededError")) return `${role}_MAX_TURNS_EXCEEDED`;
  if (hasName("ModelRefusalError")) return `${role}_MODEL_REFUSED`;
  return fallback;
}
