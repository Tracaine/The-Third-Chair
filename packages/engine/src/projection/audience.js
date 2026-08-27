export function allowedAudiences(viewer) {
    return new Set(["PUBLIC", "PARTY", viewer]);
}
export function visible(records, viewer) {
    const allowed = allowedAudiences(viewer);
    return records.filter((record) => allowed.has(record.audience));
}
//# sourceMappingURL=audience.js.map