import * as Types from "@wpazderski/kvapi-types";
import * as level from "classic-level";
import * as errors from "../../errors";
import * as dbErrors from "../errors";
import { Db, DbInternalDataKey, SubDbLimits } from "../Db";
import { Deferred } from "../../utils";
import { AppConfig } from "../../AppConfig";

type SubLevel = ReturnType<level.ClassicLevel["sublevel"]>;

interface InternalData {
    numEntries: number;
    dbSize: number;
}

export class Level implements Db {
    
    private internalData: InternalData = {
        dbSize: 0,
        numEntries: 0,
    };
    private internalDataLoadingDeferred: Deferred<void> | null = null;
    private db: level.ClassicLevel | SubLevel;
    
    constructor(private parent?: Level, subDbName?: string, private limits?: SubDbLimits) {
        if (this.parent && subDbName) {
            this.db = this.parent.db.sublevel(subDbName) as any;
        }
        else {
            this.db = new level.ClassicLevel("./db/", { valueEncoding: "json" });
        }
    }
    
    getSubDb(subDbName: string, limits?: SubDbLimits): Level {
        return new Level(this, subDbName, limits);
    }
    
    getUserPrivateSubDb(userId: Types.data.user.Id, appConfig: AppConfig): Level {
        return this.getSubDb(
            `userPrv-${userId}`, 
            {
                valueMaxSize: appConfig.valueMaxSize,
                privateDbMaxNumEntries: appConfig.privateDbMaxNumEntries,
                privateDbMaxSize: appConfig.privateDbMaxSize,
            },
        );
    }
    
    async write(key: Types.data.entry.Key, value: Types.data.entry.Value): Promise<void> {
        await this.ensureInternalDataLoaded();
        const isNewEntry = !(await this.has(key));
        let deltaSize: number = 0;
        if (isNewEntry) {
            deltaSize += key.length + value.length;
        }
        else {
            const oldValueLength = (await this.read(key)).length;
            deltaSize += value.length - oldValueLength;
        }
        if (this.limits && isNewEntry && this.internalData.numEntries + 1 > this.limits.privateDbMaxNumEntries) {
            throw new dbErrors.DbNumEntriesLimitError();
        }
        if (this.limits && this.internalData.dbSize + deltaSize > this.limits.privateDbMaxSize) {
            throw new dbErrors.DbSizeLimitError();
        }
        if (isNewEntry) {
            this.internalData.numEntries += 1;
        }
        this.internalData.dbSize += deltaSize;
        await this.saveInternalData();
        try {
            await this.db.put(key, value);
        }
        catch (err) {
            if (isNewEntry) {
                this.internalData.numEntries -= 1;
            }
            this.internalData.dbSize -= deltaSize;
            await this.saveInternalData();
            throw err;
        }
    }
    
    async writeMany(keyValueMap: Types.data.entry.KeyValueMap): Promise<void> {
        await this.ensureInternalDataLoaded();
        let numNewEntries: number = 0;
        let deltaSize: number = 0;
        for (const _key in keyValueMap) {
            const key = _key as Types.data.entry.Key;
            const value = keyValueMap[key]!;
            const isNewEntry = !(await this.has(key));
            if (isNewEntry) {
                numNewEntries++;
                deltaSize += key.length + value.length;
            }
            else {
                const oldValueLength = (await this.read(key)).length;
                deltaSize += value.length - oldValueLength;
            }
        }
        if (this.limits && this.internalData.numEntries + numNewEntries > this.limits.privateDbMaxNumEntries) {
            throw new dbErrors.DbNumEntriesLimitError();
        }
        if (this.limits && this.internalData.dbSize + deltaSize > this.limits.privateDbMaxSize) {
            throw new dbErrors.DbSizeLimitError();
        }
        this.internalData.numEntries += numNewEntries;
        this.internalData.dbSize += deltaSize;
        await this.saveInternalData();
        try {
            await this.db.batch(Object.entries(keyValueMap).map(entry => ({
                type: "put",
                key: entry[0],
                value: entry[1],
            })));
        }
        catch (err) {
            this.internalData.numEntries -= numNewEntries;
            this.internalData.dbSize -= deltaSize;
            await this.saveInternalData();
            throw err;
        }
    }
    
    async read(key: Types.data.entry.Key): Promise<Types.data.entry.Value> {
        await this.ensureInternalDataLoaded();
        try {
            const result = await this.db.get(key) as Types.data.entry.Value;
            return result;
        }
        catch (err) {
            if (err && (<any>err).code === "LEVEL_NOT_FOUND") {
                throw new errors.NotFound();
            }
            else {
                throw new errors.InternalServerError(err);
            }
        }
    }
    
    async readMany(keys: Types.data.entry.Key[]): Promise<Types.data.entry.KeyValueMap> {
        await this.ensureInternalDataLoaded();
        const values = await this.db.getMany(keys) as Types.data.entry.Value[];
        const result: Types.data.entry.KeyValueMap = {};
        for (let i = 0; i < keys.length; ++i) {
            result[keys[i]!] = values[i]!;
        }
        return result;
    }
    
    async readManyAsArray(keys: Types.data.entry.Key[]): Promise<Types.data.entry.KeyValuePair[]> {
        await this.ensureInternalDataLoaded();
        const values = await this.db.getMany(keys) as Types.data.entry.Value[];
        const result: Types.data.entry.KeyValuePair[] = [];
        for (let i = 0; i < keys.length; ++i) {
            result.push({ key: keys[i]!, value: values[i]! });
        }
        return result;
    }
    
    async readAll(): Promise<Types.data.entry.KeyValueMap> {
        await this.ensureInternalDataLoaded();
        const result = Object.fromEntries(await this.db.iterator().all()) as Types.data.entry.KeyValueMap;
        if (DbInternalDataKey in result) {
            delete result[DbInternalDataKey as Types.data.entry.Key];
        }
        return result;
    }
    
    async readAllAsArray(): Promise<Types.data.entry.KeyValuePair[]> {
        await this.ensureInternalDataLoaded();
        const result = (await this.db.iterator().all() as Types.data.entry.KeyValueTuple[]).map(entry => ({
            key: entry[0],
            value: entry[1],
        })).filter(entry => entry.key !== DbInternalDataKey);
        return result;
    }
    
    async delete(key: Types.data.entry.Key): Promise<void> {
        await this.ensureInternalDataLoaded();
        if (!(await this.has(key))) {
            return;
        }
        const size = (await this.read(key)).length;
        await this.db.del(key);
        this.internalData.numEntries -= 1;
        this.internalData.dbSize -= size;
        await this.saveInternalData();
    }
    
    async deleteMany(keysOrig: Types.data.entry.Key[]): Promise<void> {
        await this.ensureInternalDataLoaded();
        const keys: Types.data.entry.Key[] = [];
        let size: number = 0;
        for (const key of keysOrig) {
            if (await this.has(key)) {
                keys.push(key);
                size += (await this.read(key)).length;
            }
        }
        await this.db.batch(keys.map(key => ({
            type: "del",
            key: key,
        })));
        this.internalData.numEntries -= keys.length;
        this.internalData.dbSize -= size;
        await this.saveInternalData();
    }
    
    async deleteAll(): Promise<void> {
        await this.ensureInternalDataLoaded();
        await this.db.clear();
        this.internalData.dbSize = 0;
        this.internalData.numEntries = 0;
        await this.saveInternalData();
    }
    
    async has(key: Types.data.entry.Key): Promise<boolean> {
        await this.ensureInternalDataLoaded();
        try {
            await this.db.get(key) as Types.data.entry.Value;
            return true;
        }
        catch (err) {
            if (err && (<any>err).code === "LEVEL_NOT_FOUND") {
                return false;
            }
            else {
                throw new errors.InternalServerError(err);
            }
        }
    }
    
    private async ensureInternalDataLoaded(): Promise<void> {
        if (this.internalDataLoadingDeferred) {
            return this.internalDataLoadingDeferred.getPromise();
        }
        this.internalDataLoadingDeferred = new Deferred();
        try {
            this.internalData = JSON.parse(await this.db.get(DbInternalDataKey) as string);
            this.internalDataLoadingDeferred.resolve();
        }
        catch (err) {
            if (err && (<any>err).code === "LEVEL_NOT_FOUND") {
                this.internalData = {
                    dbSize: 0,
                    numEntries: 0,
                };
                this.internalDataLoadingDeferred.resolve();
            }
            else {
                this.internalDataLoadingDeferred.reject(err);
                this.internalDataLoadingDeferred = null;
                throw err;
            }
        }
    }
    
    private async saveInternalData(): Promise<void> {
        await this.ensureInternalDataLoaded();
        await this.db.put(DbInternalDataKey, JSON.stringify(this.internalData));
    }
    
}
