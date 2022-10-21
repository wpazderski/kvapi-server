import * as Types from "@wpazderski/kvapi-types";
import * as errors from "../errors";
import { App } from "../App";
import { errors as dbErrors, Db, DbInternalDataKey } from "../db";
import { Session } from "../SessionManager";
import { Validation } from "../utils/Validation";
import { ApiEndpointGroup } from "./Api";

interface EntryAccessMode {
    entryAccess: Types.data.entry.EntryAccess;
    minUserRole: Types.data.user.Role;
}

const entryAccessModes: EntryAccessMode[] = [
    { entryAccess: "public", minUserRole: "unauthorized" },
    { entryAccess: "private", minUserRole: "authorized" },
];

export class Entries implements ApiEndpointGroup {
    
    private valueMaxSize: number;
    
    constructor(private app: App) {
        this.valueMaxSize = this.app.appConfig.valueMaxSize;
        
        let enabledEntryAccessModes: EntryAccessMode[];
        if (this.app.appConfig.disablePublicEntries) {
            enabledEntryAccessModes = entryAccessModes.filter(entryAccessMode => entryAccessMode.entryAccess !== "public");
        }
        else {
            enabledEntryAccessModes = [...entryAccessModes];
        }
        
        for (const { entryAccess, minUserRole } of enabledEntryAccessModes) {
            this.app.api.registerEndpoint("get", `${entryAccess}-entries`, (_params, req, session) => this.getEntries(entryAccess, req as Types.api.entries.GetEntriesRequest, session), minUserRole);
            this.app.api.registerEndpoint("get", `${entryAccess}-entries/:key`, (params, req, session) => this.getEntry(entryAccess, params as Types.api.entries.KeyParams, req as Types.api.entries.GetEntryRequest, session), minUserRole);
            this.app.api.registerEndpoint("put", `${entryAccess}-entries/:key`, (params, req, session) => this.createOrUpdateEntry(entryAccess, params as Types.api.entries.KeyParams, req as Types.api.entries.CreateOrUpdateEntryRequest, session), minUserRole);
            this.app.api.registerEndpoint("delete", `${entryAccess}-entries/:key`, (params, req, session) => this.deleteEntry(entryAccess, params as Types.api.entries.KeyParams, req as Types.api.entries.DeleteEntryRequest, session), minUserRole);
        }
    }
    
    async getEntries(entryAccess: Types.data.entry.EntryAccess, _req: Types.api.entries.GetEntriesRequest, session: Session): Promise<Types.api.entries.GetEntriesResponse> {
        const db = this.getDb(entryAccess, session);
        const entries = await db.readAll();
        return { entries };
    }
    
    private async getEntry(entryAccess: Types.data.entry.EntryAccess, params: Types.api.entries.KeyParams, _req: Types.api.entries.GetEntryRequest, session: Session): Promise<Types.api.entries.GetEntryResponse> {
        this.validateKey(params.key);
        const db = this.getDb(entryAccess, session);
        const value = await db.read(params.key);
        return { value };
    }
    
    private async createOrUpdateEntry(entryAccess: Types.data.entry.EntryAccess, params: Types.api.entries.KeyParams, req: Types.api.entries.CreateOrUpdateEntryRequest, session: Session): Promise<Types.api.entries.CreateOrUpdateEntryResponse> {
        this.validateKey(params.key);
        this.validateValue(req.value);
        const db = this.getDb(entryAccess, session);
        try {
            await db.write(params.key, req.value);
        }
        catch (err) {
            if (err instanceof dbErrors.DbNumEntriesLimitError) {
                throw new errors.BadRequest("numberOfEntriesLimit");
            }
            else if (err instanceof dbErrors.DbSizeLimitError) {
                throw new errors.BadRequest("dbSizeLimit");
            }
            else {
                throw err;
            }
        }
        return {};
    }
    
    private async deleteEntry(entryAccess: Types.data.entry.EntryAccess, params: Types.api.entries.KeyParams, _req: Types.api.entries.DeleteEntryRequest, session: Session): Promise<Types.api.entries.DeleteEntryResponse> {
        this.validateKey(params.key);
        const db = this.getDb(entryAccess, session);
        await db.delete(params.key);
        return {};
    }
    
    private validateKey(key: Types.data.entry.Key): void {
        Validation.stringType(key, "key");
        Validation.minLength(key, 1, "key");
        Validation.maxLength(key, 1024, "key");
        Validation.regex(key, /^[a-zA-Z0-9_\-]+$/, "key");
        if (key === DbInternalDataKey) {
            throw new errors.BadRequest("keyReservedForInternalUsage");
        }
    }
    
    private validateValue(value: Types.data.entry.Value): void {
        Validation.stringType(value, "value");
        Validation.maxLength(value, this.valueMaxSize, "value");
    }
    
    private getDb(entryAccess: Types.data.entry.EntryAccess, session: Session): Db {
        switch (entryAccess) {
            case "public":
                return this.app.publicEntriesDb;
            case "private":
                return session.userPrivateDb!;
        }
    }
    
}
