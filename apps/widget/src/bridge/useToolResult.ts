import { useEffect, useRef, useState } from "react";
import { TableViewPayloadSchema } from "@third-chair/contracts";
import type { TableViewModel } from "../contracts";
import type { McpTableBridge } from "./mcp-app";

function parseView(value: unknown): TableViewModel | undefined {
  const parsed = TableViewPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function isNewResult(current: TableViewModel, next: TableViewModel): boolean {
  if (next.playerViewId === current.playerViewId) return false;
  if (next.playerView.stateVersion <= current.playerView.stateVersion) return false;
  if (current.lastMutationId && next.lastMutationId === current.lastMutationId) return false;
  return true;
}

export function useToolResult(initial: TableViewModel, bridge?: McpTableBridge) {
  const hostInitial = parseView(window.openai?.toolOutput);
  const [view, setView] = useState<TableViewModel>(hostInitial ?? initial);
  const current = useRef(view);
  current.current = view;

  const accept = (value: unknown) => {
    const next = parseView(value);
    if (next && isNewResult(current.current, next)) setView(next);
  };

  useEffect(() => {
    if (!bridge) return;
    let disposed = false;
    let disconnect: (() => void) | undefined;
    void bridge.connect(accept).then((cleanup) => {
      if (disposed) cleanup();
      else disconnect = cleanup;
    }).catch(() => {
      // The fixture remains usable while the host decides whether to reconnect.
    });
    return () => { disposed = true; disconnect?.(); };
  }, [bridge]);

  return { view, accept };
}
