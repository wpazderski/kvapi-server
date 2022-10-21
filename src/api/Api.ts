import * as Types from "@wpazderski/kvapi-types";
import express from "express";
import * as errors from "../errors";
import { App } from "../App";
import { Session } from "../SessionManager";
import { Entries } from "./Entries";
import { Users } from "./Users";
import { Sessions } from "./Sessions";
import { UserManager } from "../UserManager";
import { AppInfo } from "./AppInfo";
import { Batch } from "./Batch";
import { StatusTexts } from "../errors";

export interface ApiEndpointGroup {
}

export type EndpointHandler<TParams extends object = object, TReq extends object = object, TRes extends object = object> = (params: TParams, req: TReq, session: Session) => Promise<TRes>;
type FinalEndpointHandler = (req: express.Request, res: express.Response) => Promise<void>;
type MinUserRoleEx = Types.data.user.Role | (() => Types.data.user.Role);

interface EndpointRequest {
    method: express.Request["method"];
    url: express.Request["url"];
    params: express.Request["params"];
    body: express.Request["body"];
    session: Session | null;
}

interface EndpointResponse {
    statusCode: number;
    result: any;
}

type BatchedRequestHandler = (request: EndpointRequest) => Promise<EndpointResponse>;

export class Api {
    
    private endpointGroups: ApiEndpointGroup[] = [];
    private batchedRequestHandlers: { [key: string]: BatchedRequestHandler } = {};
    
    constructor(private app: App) {
    }
    
    async init(): Promise<void> {
        this.registerEndpointGroups();
    }
    
    private registerEndpointGroups(): void {
        this.endpointGroups.push(new AppInfo(this.app));
        this.endpointGroups.push(new Batch(this.app));
        this.endpointGroups.push(new Entries(this.app));
        this.endpointGroups.push(new Sessions(this.app));
        this.endpointGroups.push(new Users(this.app));
    }
    
    registerEndpoint(method: Types.api.request.Method, url: string, handler: EndpointHandler, minUserRoleEx: MinUserRoleEx, canBeBatched: boolean = true): void {
        const endpointUrl = this.createEndpointUrl(url);
        if (this.app.appConfig.devMode) {
            console.log(`registerEndpoint: ${method.toUpperCase().padStart(8, " ")} ${endpointUrl}`);
        }
        const endpoint = this.createFinalEndpointHandler(handler, minUserRoleEx);
        if (method === "get") {
            this.app.expressApp.get(endpointUrl, endpoint);
        }
        else if (method === "post") {
            this.app.expressApp.post(endpointUrl, endpoint);
        }
        else if (method === "patch") {
            this.app.expressApp.patch(endpointUrl, endpoint);
        }
        else if (method === "put") {
            this.app.expressApp.put(endpointUrl, endpoint);
        }
        else if (method === "delete") {
            this.app.expressApp.delete(endpointUrl, endpoint);
        }
        
        if (canBeBatched) {
            this.batchedRequestHandlers[this.createBatchedRequestKey(method, url)] = request => this.handleEndpointRequest(request, true, minUserRoleEx, handler);
        }
    }
    
    private createBatchedRequestKey(method: Types.api.request.Method, url: string): string {
        let key = `${method} ${url}`;
        return key;
    }
    
    private createEndpointUrl(url: string): string {
        return `${this.app.appConfig.apiBaseUrl}${url}`;
    }
    
    private createFinalEndpointHandler(handler: EndpointHandler, minUserRoleEx: MinUserRoleEx): FinalEndpointHandler {
        return async (req: express.Request, res: express.Response) => {
            const body = req.body;
            const params = req.params;
            const method = req.method;
            const url = req.url;
            const sessionId = req.get("kvapi-session-id") as Types.data.session.Id;
            const session = this.app.sessionManager.getSessionById(sessionId);
            const response = await this.handleEndpointRequest({ method, url, params, body, session }, false, minUserRoleEx, handler);
            res.status(response.statusCode);
            res.json(response.result);
        };
    }
    
    private async handleEndpointRequest(request: EndpointRequest, isBatched: boolean, minUserRoleEx: MinUserRoleEx, handler: EndpointHandler): Promise<EndpointResponse> {
        let result: object | null = null;
        let endpointError: errors.EndpointError | null = null;
        if (this.app.appConfig.devMode) {
            console.log(`${isBatched ? "batched " : ""}request: ${request.method} ${request.url}`);
            console.log(`    params: ${JSON.stringify(request.params)}`);
            console.log(`      body: ${JSON.stringify(request.body)}`);
        }
        try {
            this.checkAuth(request.session, minUserRoleEx);
            if (request.session) {
                this.app.sessionManager.updateSessionLastActivity(request.session.id);
            }
            result = await handler(request.params, request.body, request.session ?? this.app.sessionManager.getEmptySession());
        }
        catch (e) {
            if (e instanceof errors.EndpointError) {
                endpointError = e;
            }
            else {
                endpointError = new errors.InternalServerError(e);
            }
        }
        if (endpointError) {
            if (endpointError instanceof errors.InternalServerError) {
                console.error("Internal Server Error:", endpointError.getDetails());
            }
            return {
                statusCode: endpointError.getStatusCode(),
                result: endpointError.getDetails(),
            };
        }
        else {
            return {
                statusCode: 200,
                result,
            };
        }
    }
    
    private checkAuth(session: Session | null, minUserRoleEx: MinUserRoleEx): void {
        const minUserRole = typeof(minUserRoleEx) === "function" ? minUserRoleEx() : minUserRoleEx;
        const user = session ? this.app.userManager.getUserById(session.userId) : null;
        const userRole: Types.data.user.Role = user ? user.role : "unauthorized";
        const minUserRoleNum = UserManager.convertUserRoleToNumberForComparison(minUserRole);
        const userRoleNum = UserManager.convertUserRoleToNumberForComparison(userRole);
        if (userRoleNum < minUserRoleNum) {
            if (userRole === "unauthorized") {
                throw new errors.Unauthorized();
            }
            else {
                throw new errors.Forbidden();
            }
        }
    }
    
    
    async handleBatchedRequest(request: Types.api.batch.BatchedRequest, session: Session): Promise<Types.api.batch.BatchedResponse> {
        const foundResult = this.findBatchedRequestHandler(request.method, request.url);
        if (!foundResult) {
            return {
                statusCode: 404,
                statusText: StatusTexts[404],
                response: "",
            };
        }
        const { handler, params } = foundResult;
        let body: any = null;
        if (request.data && typeof(request.data) === "object") {
            body = request.data;
        }
        else {
            
            try {
                body = JSON.parse(request.data);
            }
            catch {}
        }
        const response = await handler({
            body,
            method: request.method,
            params,
            session,
            url: request.url,
        });
        return {
            statusCode: response.statusCode,
            statusText: (StatusTexts as any)[response.statusCode],
            response: JSON.stringify(response.result),
        };
    }
    
    private findBatchedRequestHandler(method: Types.api.request.Method, url: string): { handler: BatchedRequestHandler, params: express.Request["params"] } | null {
        const reqKey = this.createBatchedRequestKey(method, url);
        const reqParts = reqKey.split("/").filter(part => part.length > 0);
        for (const key in this.batchedRequestHandlers) {
            const keyParts = key.split("/").filter(part => part.length > 0);
            if (reqParts.length !== keyParts.length) {
                continue;
            }
            const params: express.Request["params"] = {};
            let matches: boolean = true;
            for (let i = 0; i < keyParts.length; ++i) {
                const keyPart = keyParts[i]!;
                const reqPart = reqParts[i]!;
                if (keyPart.startsWith(":")) {
                    params[keyPart.substring(1)] = reqPart;
                }
                else if (keyPart !== reqPart) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                return {
                    handler: this.batchedRequestHandlers[key]!,
                    params,
                };
            }
        }
        return null;
    }
    
}
