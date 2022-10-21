import * as Types from "@wpazderski/kvapi-types";
import { App } from "../App";
import { ApiEndpointGroup } from "./Api";

export class AppInfo implements ApiEndpointGroup {
    
    constructor(private app: App) {
        this.app.api.registerEndpoint("get", "app-info", (_params, req) => this.getAppInfo(req as Types.api.appInfo.GetAppInfoRequest), "unauthorized");
    }
    
    async getAppInfo(_req: Types.api.appInfo.GetAppInfoRequest): Promise<Types.api.appInfo.GetAppInfoResponse> {
        return {
            devMode: this.app.appConfig.devMode,
            hasAnyUsers: this.app.userManager.hasAnyUsers(),
            sessionMaxInactivityTime: this.app.appConfig.sessionMaxInactivityTime,
            valueMaxSize: this.app.appConfig.valueMaxSize,
            privateDbMaxNumEntries: this.app.appConfig.privateDbMaxNumEntries,
            privateDbMaxSize: this.app.appConfig.privateDbMaxSize,
            disablePublicEntries: this.app.appConfig.disablePublicEntries,
        };
    }
    
}
