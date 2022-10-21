import * as Types from "@wpazderski/kvapi-types";
import * as errors from "../errors";
import { App } from "../App";
import { Session } from "../SessionManager";
import { ApiEndpointGroup } from "./Api";

export class Sessions implements ApiEndpointGroup {
    
    constructor(private app: App) {
        this.app.api.registerEndpoint("post", "sessions", (_params, req) => this.createSession(req as Types.api.sessions.CreateSessionRequest), "unauthorized", false);
        this.app.api.registerEndpoint("patch", "sessions", (_params, req, session) => this.updateSession(req as Types.api.sessions.UpdateSessionRequest, session), "authorized", false);
        this.app.api.registerEndpoint("delete", "sessions", (_params, req, session) => this.deleteSession(req as Types.api.sessions.DeleteSessionRequest, session), "authorized", false);
    }
    
    private async createSession(req: Types.api.sessions.CreateSessionRequest): Promise<Types.api.sessions.CreateSessionResponse> {
        const user = this.app.userManager.getUserByLoginData(req.userLogin, req.userPassword);
        if (!user) {
            throw new errors.NotFound("invalidLoginData");
        }
        const session = this.app.sessionManager.createSession(user.id);
        const userWithoutPassword: Types.data.user.UserWithoutPassword = { ...user };
        delete (userWithoutPassword as any).password;
        return {
            id: session.id,
            user: userWithoutPassword,
        };
    }
    
    private async updateSession(_req: Types.api.sessions.UpdateSessionRequest, _session: Session): Promise<Types.api.sessions.UpdateSessionResponse> {
        // Nothing to do - session is automatically renewed at the beginning of processing any endpoint
        return {};
    }
    
    private async deleteSession(_req: Types.api.sessions.DeleteSessionRequest, session: Session): Promise<Types.api.sessions.DeleteSessionResponse> {
        if (session && session.id) {
            this.app.sessionManager.terminateSessionById(session.id);
        }
        return {};
    }
    
}
