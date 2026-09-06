export interface OpenAIHostApi {
  readonly toolOutput?: unknown;
  readonly theme?: "light" | "dark";
  readonly locale?: string;
  readonly safeArea?: { readonly insets?: { readonly top?: number; readonly right?: number; readonly bottom?: number; readonly left?: number } };
  readonly widgetState?: unknown;
  setWidgetState?: (state: Record<string, unknown>) => void | Promise<void>;
  requestDisplayMode?: (options: { mode: "inline" | "pip" | "fullscreen" }) => Promise<unknown>;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    openai?: OpenAIHostApi;
  }
}

export function applyHostPresentation(): () => void {
  const apply = () => {
    const theme = window.openai?.theme;
    if (theme) document.documentElement.dataset.theme = theme;
  };
  apply();
  window.addEventListener("openai:set_globals", apply);
  return () => window.removeEventListener("openai:set_globals", apply);
}
