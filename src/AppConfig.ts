import * as dotenv from "dotenv";

dotenv.config();

type UnitsMap = { [key: string]: number };

const byteUnits: UnitsMap = {
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
};

const timeUnits: UnitsMap = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
};

export class AppConfig {
    
    get devMode(): boolean {
        return this.getEnvBoolean("KVAPI_DEV_MODE", false);
    }
    
    get dbEngine(): string {
        return this.getEnvString("KVAPI_DB_ENGINE", "Level");
    }
    
    get port(): number {
        return this.getEnvNumberInt("KVAPI_PORT", 23501);
    }
    
    get staticBaseUrl(): string {
        return this.ensureHasTrailingSlash(this.getEnvString("KVAPI_STATIC_BASE_URL", "/"));
    }
    
    get apiBaseUrl(): string {
        return this.ensureHasTrailingSlash(this.getEnvString("KVAPI_API_BASE_URL", "/api/"));
    }
    
    get sslKeyFilePath(): string {
        return this.getEnvString("KVAPI_SSL_KEY_FILE_PATH", "ssl-certs/cert.key");
    }
    
    get sslCrtFilePath(): string {
        return this.getEnvString("KVAPI_SSL_CRT_FILE_PATH", "ssl-certs/cert.crt");
    }
    
    get staticPath(): string {
        return this.ensureHasTrailingSlash(this.getEnvString("KVAPI_STATIC_PATH", "../kvapi-client/example/"));
    }
    
    get privateDbMaxNumEntries(): number {
        return this.getEnvNumberFloat("KVAPI_PRIVATE_DB_MAX_NUM_ENTRIES", 100000);
    }
    
    get privateDbMaxSize(): number {
        return this.getEnvNumberFloat("KVAPI_PRIVATE_DB_MAX_SIZE", 1 * 1024 * 1024 * 1024, byteUnits);
    }
    
    get valueMaxSize(): number {
        return this.getEnvNumberFloat("KVAPI_VALUE_MAX_SIZE", 8 * 1024 * 1024, byteUnits);
    }
    
    get disablePublicEntries(): boolean {
        return this.getEnvBoolean("KVAPI_DISABLE_PUBLIC_ENTRIES", false);
    }
    
    get sessionMaxInactivityTime(): number {
        return this.getEnvNumberFloat("KVAPI_SESSION_MAX_INACTIVITY_TIME", 60 * 60 * 1000, timeUnits);
    }
    
    constructor() {
        dotenv.config();
    }
    
    private getEnvString(key: string, defaultValue: string): string {
        const envValue = process.env[key];
        return typeof(envValue) === "string" ? envValue : defaultValue;
    }
    
    private getEnvBoolean(key: string, defaultValue: boolean): boolean {
        const rawEnvValue = this.getEnvString(key, `${defaultValue}`).toLowerCase();
        const trueValues = ["1", "true", "on", "enabled"];
        return trueValues.includes(rawEnvValue);
    }
    
    private getEnvNumberInt(key: string, defaultValue: number, units?: UnitsMap): number {
        const envStr = this.getEnvString(key, `${defaultValue}`);
        const multiplier = units ? this.getUnitMultiplier(envStr, units) : 1;
        const envValue = multiplier * parseInt(envStr);
        return isNaN(envValue) ? defaultValue : envValue;
    }
    
    private getEnvNumberFloat(key: string, defaultValue: number, units?: UnitsMap): number {
        const envStr = this.getEnvString(key, `${defaultValue}`);
        const multiplier = units ? this.getUnitMultiplier(envStr, units) : 1;
        const envValue = multiplier * parseFloat(envStr);
        return isNaN(envValue) ? defaultValue : envValue;
    }
    
    private getUnitMultiplier(envStr: string, units: UnitsMap): number {
        envStr = envStr.toLowerCase();
        for (const unit in units) {
            if (envStr.endsWith(unit)) {
                return units[unit]!;
            }
        }
        return 1;
    }
    
    private ensureHasTrailingSlash(str: string): string {
        if (!str.endsWith("/")) {
            str += "/";
        }
        return str;
    }
    
}
