import { DatabaseSync } from "node:sqlite";
export declare const CAMPAIGN_DATABASE_BUSY_TIMEOUT_MS = 5000;
export declare function openCampaignDatabase(path: string): DatabaseSync;
export declare function verifyDatabase(db: DatabaseSync): void;
export declare function checkpointCampaignDatabase(db: DatabaseSync): void;
//# sourceMappingURL=database.d.ts.map