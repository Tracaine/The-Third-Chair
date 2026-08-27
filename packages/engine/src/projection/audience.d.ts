import type { Audience, PlayerSeat } from "@third-chair/contracts";
export declare function allowedAudiences(viewer: PlayerSeat): ReadonlySet<Audience>;
export declare function visible<T extends {
    audience: Audience;
}>(records: readonly T[], viewer: PlayerSeat): T[];
//# sourceMappingURL=audience.d.ts.map