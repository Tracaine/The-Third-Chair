export interface SqliteMigration {
    readonly version: number;
    readonly name: string;
    readonly sql: string;
}
export interface MigrationRunOptions {
    readonly migrations?: readonly SqliteMigration[];
}
export interface MigrationRunResult {
    readonly appliedVersions: readonly number[];
    readonly backupPath: string | undefined;
}
export declare class MigrationFailure extends Error {
    readonly backupPath: string | undefined;
    constructor(message: string, backupPath: string | undefined, cause: unknown);
}
export declare function runMigrationsWithBackup(databasePath: string, options?: MigrationRunOptions): MigrationRunResult;
//# sourceMappingURL=migrations.d.ts.map