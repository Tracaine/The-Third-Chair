export interface ServerConfig {
    readonly port: number;
    readonly host: string;
    readonly fakeMode: boolean;
}
export declare function readConfig(env?: NodeJS.ProcessEnv): ServerConfig;
//# sourceMappingURL=config.d.ts.map