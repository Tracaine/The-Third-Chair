export function playerResult(status, structuredContent, meta = {}) {
    return { content: [{ type: "text", text: status }], structuredContent, _meta: meta };
}
//# sourceMappingURL=result.js.map