export type ProviderRole = "DIRECTOR" | "NARRATOR";

export interface ProviderFailureDiagnostic {
  readonly status?: number;
  readonly code?: string;
  readonly type?: string;
  readonly param?: string;
  readonly name?: string;
  readonly causeName?: string;
  readonly localCode?: string;
  readonly requestId?: string;
  readonly toolName?: string;
}

function safeText(value: unknown, lowerCase = false): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 200
    || !/^[A-Za-z0-9_.:[\]-]+$/.test(value)) return undefined;
  return lowerCase ? value.toLowerCase() : value;
}

function safeMetadata(error: unknown): ProviderFailureDiagnostic[] {
  const metadata: ProviderFailureDiagnostic[] = [];
  const seen = new Set<object>();
  const pending: unknown[] = [error];
  for (let step = 0; step < 10 && pending.length > 0; step += 1) {
    const current = pending.shift();
    if (typeof current !== "object" || current === null) continue;
    if (seen.has(current)) continue;
    seen.add(current);
    const value = current as Record<string, unknown>;
    const code = safeText(value.code, true);
    const type = safeText(value.type, true);
    const param = safeText(value.param);
    const name = safeText(value.name);
    const localCode = typeof value.message === "string" && /^[A-Z][A-Z0-9_:.-]{2,100}$/.test(value.message)
      ? value.message : undefined;
    const requestId = safeText(value.requestID ?? value.requestId ?? value.request_id);
    metadata.push({
      ...(Number.isInteger(value.status) && (value.status as number) >= 100 && (value.status as number) <= 599
        ? { status: value.status as number } : {}),
      ...(code === undefined ? {} : { code }),
      ...(type === undefined ? {} : { type }),
      ...(param === undefined ? {} : { param }),
      ...(name === undefined ? {} : { name }),
      ...(localCode === undefined ? {} : { localCode }),
      ...(requestId === undefined ? {} : { requestId }),
    });
    pending.push(value.cause, value.error);
  }
  return metadata;
}

export function providerFailureDiagnostic(error: unknown): ProviderFailureDiagnostic {
  const merged: Record<string, unknown> = {};
  for (const item of safeMetadata(error)) {
    for (const [key, value] of Object.entries(item)) {
      if (key === "name" && merged.name !== undefined && merged.name !== value && merged.causeName === undefined) {
        merged.causeName = value;
      } else if (merged[key] === undefined) merged[key] = value;
    }
  }
  return merged as ProviderFailureDiagnostic;
}

export class SanitizedProviderError extends Error {
  readonly diagnostic: ProviderFailureDiagnostic;

  constructor(code: string, error: unknown, toolName?: string) {
    super(code);
    this.name = "SanitizedProviderError";
    const diagnostic = providerFailureDiagnostic(error);
    const safeToolName = safeText(toolName);
    this.diagnostic = safeToolName === undefined ? diagnostic : { ...diagnostic, toolName: safeToolName };
  }
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
  if (hasName("InvalidToolInputError")) return `${role}_TOOL_INPUT_INVALID`;
  if (hasName("InvalidToolOutputError")) return `${role}_TOOL_OUTPUT_INVALID`;
  if (hasName("ToolTimeoutError")) return `${role}_TOOL_TIMEOUT`;
  if (hasName("ToolCallError")) return `${role}_TOOL_CALL_FAILED`;
  return fallback;
}
