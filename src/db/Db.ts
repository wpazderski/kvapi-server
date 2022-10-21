import * as Types from "@wpazderski/kvapi-types";
import { AppConfig } from "../AppConfig";

export const DbInternalDataKey: string = "kvapi-db-internal-data-jht3c9b4c7h";

export interface SubDbLimits {
    valueMaxSize: number;
    privateDbMaxNumEntries: number;
    privateDbMaxSize: number;
}

export interface Db {
    
    getSubDb(name: string, limits?: SubDbLimits): Db;
    getUserPrivateSubDb(userId: Types.data.user.Id, appConfig: AppConfig): Db;
    
    write(key: Types.data.entry.Key, value: Types.data.entry.Value): Promise<void>;
    writeMany(keyValueMap: Types.data.entry.KeyValueMap): Promise<void>;
    
    read(key: Types.data.entry.Key): Promise<Types.data.entry.Value>;
    readMany(keys: Types.data.entry.Key[]): Promise<Types.data.entry.KeyValueMap>;
    readManyAsArray(keys: Types.data.entry.Key[]): Promise<Types.data.entry.KeyValuePair[]>;
    readAll(): Promise<Types.data.entry.KeyValueMap>;
    readAllAsArray(): Promise<Types.data.entry.KeyValuePair[]>;
    
    delete(key: Types.data.entry.Key): Promise<void>;
    deleteMany(keys: Types.data.entry.Key[]): Promise<void>;
    deleteAll(): Promise<void>;
    
    has(key: Types.data.entry.Key): Promise<boolean>;
    
}
