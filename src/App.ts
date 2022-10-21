import express from "express";
import * as fs from "fs";
import * as https from "https";
import * as nodePath from "path";
import { Api } from "./api/Api";
import { AppConfig } from "./AppConfig";
import { Db } from "./db/Db";
import * as dbEngines from "./db/engines";
import { SessionManager } from "./SessionManager";
import { UserManager } from "./UserManager";
import { Deferred } from "./utils";

export class App {
    
    static async create(): Promise<App> {
        const app = new App();
        await app.init();
        return app;
    }
    
    
    
    
    
    private _api: Api;
    private _appConfig: AppConfig;
    private _mainDb: Db;
    private _publicEntriesDb: Db;
    private _expressApp: express.Application;
    private _sessionManager: SessionManager;
    private _userManager: UserManager;
    private _initDeferred: Deferred<void>;
    
    get api(): Api {
        return this._api;
    }
    
    get appConfig(): AppConfig {
        return this._appConfig;
    }
    
    get mainDb(): Db {
        return this._mainDb;
    }
    
    get publicEntriesDb(): Db {
        return this._publicEntriesDb;
    }
    
    get expressApp(): express.Application {
        return this._expressApp;
    }
    
    get sessionManager(): SessionManager {
        return this._sessionManager;
    }
    
    get userManager(): UserManager {
        return this._userManager;
    }
    
    get initPromise(): Promise<void> {
        return this._initDeferred.getPromise();
    }
    
    private constructor() {
        this._api = new Api(this);
        this._appConfig = new AppConfig();
        this._mainDb = new (dbEngines as any)[this.appConfig.dbEngine]();
        this._publicEntriesDb = this.mainDb.getSubDb("public-entries");
        this._expressApp = express();
        this._sessionManager = new SessionManager(this);
        this._userManager = new UserManager(this);
        this._initDeferred = new Deferred();
    }
    
    private async init(): Promise<void> {
        const testMode = process.env["KVAPI_TEST_MODE"] === "1";
        
        this.expressApp.use(express.json({
            limit: testMode ? (10 * this.appConfig.valueMaxSize) : Math.ceil(1.1 * this.appConfig.valueMaxSize + 1024),
        }));
        
        await this.api.init();
        await this.sessionManager.init();
        await this.userManager.init();
        
        if (testMode) {
            // Endpoint run before each test (see kvapi-tests)
            const apiBaseUrl = this.appConfig.apiBaseUrl;
            this.expressApp.get(`${apiBaseUrl}reset-server-data`, async (_req, res) => {
                await this.mainDb.deleteAll();
                this.sessionManager.terminateAllSessions();
                await this.userManager.reloadUsers();
                res.send("OK");
            });
        }
        
        const staticBaseUrl = this.appConfig.staticBaseUrl;
        const staticPath = this.appConfig.staticPath;
        if (staticPath && staticBaseUrl) {
            this.expressApp.get(`${staticBaseUrl}*`, (req, res) => {
                if (this.appConfig.devMode) {
                    console.log("Request:", req.url);
                }
                let requestUrl = req.url.replace(/^\/*(.*?)\/*$/, "$1").replace(/\.\./g, "");
                if (!requestUrl.match(/\.[a-zA-Z]{1,5}$/)) {
                    requestUrl = "index.html";
                }
                if (this.appConfig.devMode) {
                    console.log("    sending", nodePath.join(process.cwd(), staticPath, requestUrl));
                }
                res.sendFile(nodePath.join(process.cwd(), staticPath, requestUrl));
            });
        }
    }
    
    async start(): Promise<void> {
        const port = this.appConfig.port;
        const sslKeyFilePath = this.appConfig.sslKeyFilePath;
        const sslCrtFilePath = this.appConfig.sslCrtFilePath;
        if (fs.existsSync(sslKeyFilePath) && fs.existsSync(sslCrtFilePath)) {
            const sslKey = fs.readFileSync(sslKeyFilePath);
            const sslCrt = fs.readFileSync(sslCrtFilePath);
            const server = https.createServer({ key: sslKey, cert: sslCrt }, this.expressApp);
            server.listen(port, () => {
                console.log(`App listening on port ${port} (HTTPS)`);
            });
        }
        else {
            this.expressApp.listen(port, () => {
                console.log(`App listening on port ${port} (HTTP)`);
                console.log("HTTPS is disabled");
            });
        }
        
    }
    
}
