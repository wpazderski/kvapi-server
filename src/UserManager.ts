import * as Types from "@wpazderski/kvapi-types";
import * as errors from "./errors";
import { Hash } from "./utils/Hash";
import { Random } from "./utils/Random";
import { Validation } from "./utils/Validation";
import { App } from "./App";
import { Db } from "./db/Db";
import { Lock } from "./utils";

export interface CreateUserParams {
    login: Types.data.user.Login;
    plainPassword: Types.data.user.PlainPassword;
    role: Types.data.user.Role;
}

export interface UpdateUserParams {
    login?: Types.data.user.Login | undefined;
    plainPassword?: Types.data.user.PlainPassword | undefined;
    role?: Types.data.user.Role | undefined;
    privateData?: Types.data.user.PrivateData | undefined;
}

export class UserManager {
    
    static convertUserRoleToNumberForComparison(role: Types.data.user.Role) : number {
        switch (role) {
            case "unauthorized":
                return 1;
            case "authorized":
                return 2;
            case "admin":
                return 3;
        }
    }
    
    static isValidUserRole(role: Types.data.user.Role): true {
        switch (role) {
            case "unauthorized":
                return true;
            case "authorized":
                return true;
            case "admin":
                return true;
        }
    }
    
    
    
    
    
    private db: Db;
    private users: Types.data.user.Users = [];
    private lock: Lock = new Lock();
    private valueMaxSize: number;
    
    constructor(private app: App) {
        this.valueMaxSize = this.app.appConfig.valueMaxSize;
        this.db = this.app.mainDb.getSubDb("users");
    }
    
    async init(): Promise<void> {
        await this.reloadUsers();
    }
    
    async reloadUsers(): Promise<void> {
        this.users = (await this.db.readAllAsArray()).map(kvp => JSON.parse(kvp.value));
        this.onUsersArrayChanged();
    }
    
    hasAnyUsers(): boolean {
        return this.users.length > 0;
    }
    
    getUserByLoginData(login: Types.data.user.Login, plainPassword: Types.data.user.PlainPassword): Types.data.user.User | null {
        const password = this.hashUserPassword(plainPassword);
        const user = this.users.find(user => user.login === login && user.password === password);
        return user ? user : null;
    }
    
    getUserById(id: Types.data.user.Id): Types.data.user.User | null {
        const user = this.users.find(user => user.id === id);
        return user ? user : null;
    }
    
    getUsersList(): Types.data.user.UsersPublic {
        return this.users.map(user => this.convertUserToUserPublic(user));
    }
    
    getUserPublic(id: Types.data.user.Id): Types.data.user.UserPublic {
        const user = this.getUserById(id);
        if (!user) {
            throw new errors.NotFound();
        }
        return this.convertUserToUserPublic(user);
    }
    
    getUserWithoutPassword(id: Types.data.user.Id): Types.data.user.UserWithoutPassword {
        const user = this.getUserById(id);
        if (!user) {
            throw new errors.NotFound();
        }
        return this.convertUserToUserWithoutPassword(user);
    }
    
    async createUser(createUserParams: CreateUserParams): Promise<Types.data.user.UserPublic> {
        return this.lock.withLock(async () => {
            const { login, plainPassword, role } = createUserParams;
            if (this.users.find(user => user.login === login)) {
                throw new errors.Conflict("userAlreadyExists");
            }
            this.validateUserLogin(login);
            this.validateUserPassword(plainPassword);
            this.validateRegisteredUserRole(role);
            const password = this.hashUserPassword(plainPassword);
            const id = this.generateUserId();
            const user = { id, login, password, role, privateData: null, lastPasswordUpdateTimestamp: 0 };
            this.users.push(user);
            this.onUsersArrayChanged();
            await this.db.write(id as string as Types.data.entry.Key, JSON.stringify(user) as Types.data.entry.Value);
            return this.convertUserToUserPublic(user);
        });
    }
    
    async updateUser(id: Types.data.user.Id, updateUserParams: UpdateUserParams): Promise<Types.data.user.UserPublic> {
        return this.lock.withLock(async () => {
            const { login, plainPassword, role, privateData } = updateUserParams;
            const user = this.getUserById(id);
            if (!user) {
                throw new errors.NotFound();
            }
            const sameLoginUser = this.users.find(user => user.login === login);
            if (sameLoginUser && sameLoginUser !== user) {
                throw new errors.Conflict("userLoginAlreadyExists");
            }
            if (login !== undefined) {
                this.validateUserLogin(login);
            }
            if (plainPassword !== undefined) {
                this.validateUserPassword(plainPassword);
            }
            if (role !== undefined) {
                this.validateRegisteredUserRole(role);
            }
            if (privateData !== undefined) {
                this.validatePrivateData(privateData);
            }
            if (login !== undefined) {
                user.login = login;
            }
            if (plainPassword !== undefined) {
                const password = this.hashUserPassword(plainPassword);
                user.password = password;
                user.lastPasswordUpdateTimestamp = Date.now();
            }
            if (role !== undefined) {
                user.role = role;
            }
            if (privateData !== undefined) {
                user.privateData = privateData;
            }
            this.onUsersArrayChanged();
            await this.db.write(id as string as Types.data.entry.Key, JSON.stringify(user) as Types.data.entry.Value);
            return this.convertUserToUserPublic(user);
        });
    }
    
    async deleteUser(id: Types.data.user.Id): Promise<void> {
        return this.lock.withLock(async () => {
            const idx = this.users.findIndex(user => user.id === id);
            if (idx < 0) {
                throw new errors.NotFound();
            }
            this.users.splice(idx, 1);
            this.onUsersArrayChanged();
            await this.db.delete(id as string as Types.data.entry.Key);
            this.app.sessionManager.terminateSessionsByUserId(id);
            const db = this.app.mainDb.getUserPrivateSubDb(id, this.app.appConfig);
            await db.deleteAll();
        });
    }
    
    private generateUserId(): Types.data.user.Id {
        while (true) {
            const userId = Random.generateString(16) as Types.data.user.Id;
            if (!this.users.find(user => user.id === userId)) {
                return userId;
            }
        }
    }
    
    private convertUserToUserPublic(user: Types.data.user.User): Types.data.user.UserPublic {
        return {
            id: user.id,
            login: user.login,
            role: user.role,
        };
    }
    
    private convertUserToUserWithoutPassword(user: Types.data.user.User): Types.data.user.UserWithoutPassword {
        return {
            id: user.id,
            login: user.login,
            role: user.role,
            lastPasswordUpdateTimestamp: user.lastPasswordUpdateTimestamp,
            privateData: user.privateData,
        };
    }
    
    private hashUserPassword(password: Types.data.user.PlainPassword): Types.data.user.Password {
        return Hash.sha512(password) as Types.data.user.Password;
    }
    
    private validateUserLogin(login: Types.data.user.Login): void {
        Validation.stringType(login, "login");
        Validation.minLength(login, 1, "login");
        Validation.maxLength(login, 128, "login");
    }
    
    private validateUserPassword(password: Types.data.user.PlainPassword): void {
        Validation.stringType(password, "password");
        Validation.minLength(password, 16, "password");
        Validation.maxLength(password, 128, "password");
    }
    
    private validatePrivateData(privateData: Types.data.user.PrivateData): void {
        Validation.stringType(privateData, "privateData");
        Validation.minLength(privateData, 0, "privateData");
        Validation.maxLength(privateData, this.valueMaxSize, "privateData");
    }
    
    private validateUserRole(role: Types.data.user.Role): void {
        if (!UserManager.isValidUserRole(role)) {
            throw new errors.BadRequest("invalidUserRole");
        }
    }
    
    private validateRegisteredUserRole(role: Types.data.user.Role): void {
        this.validateUserRole(role);
        if (role === "unauthorized") {
            throw new errors.BadRequest("invalidUserRole");
        }
    }
    
    private onUsersArrayChanged(): void {
        if (this.app.appConfig.devMode) {
            console.log("Users:");
            if (this.users.length > 0) {
                for (const user of this.users) {
                    console.log(`    ${user.id} ${user.role.padStart(15, " ")} ${user.login}`);
                }
            }
            else {
                console.log("    (no users)");
            }
        }
    }
    
}
