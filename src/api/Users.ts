import * as Types from "@wpazderski/kvapi-types";
import * as errors from "../errors";
import { App } from "../App";
import { Session } from "../SessionManager";
import { ApiEndpointGroup } from "./Api";

export class Users implements ApiEndpointGroup {
    
    constructor(private app: App) {
        this.app.api.registerEndpoint("get", "users", (_params, req) => this.getUsers(req as Types.api.users.GetUsersRequest), "admin");
        this.app.api.registerEndpoint("get", "users/:id", (params, req, session) => this.getUser(params as Types.api.users.IdParams, req as Types.api.users.GetUserRequest, session), "authorized");
        this.app.api.registerEndpoint("post", "users", (_params, req) => this.createUser(req as Types.api.users.CreateUserRequest), () => this.getMinUserRoleForUserCreation());
        this.app.api.registerEndpoint("patch", "users/:id", (params, req, session) => this.updateUser(params as Types.api.users.IdParams, req as Types.api.users.UpdateUserRequest, session), "authorized");
        this.app.api.registerEndpoint("delete", "users/:id", (params, req, session) => this.deleteUser(params as Types.api.users.IdParams, req as Types.api.users.DeleteUserRequest, session), "admin");
    }
    
    private async getUsers(_req: Types.api.users.GetUsersRequest): Promise<Types.api.users.GetUsersResponse> {
        const users = this.app.userManager.getUsersList();
        return {
            users,
        };
    }
    
    private async getUser(params: Types.api.users.IdParams, _req: Types.api.users.GetUserRequest, session: Session): Promise<Types.api.users.GetUserResponse> {
        const sessionUser = this.app.userManager.getUserById(session.userId)!;
        const sesionUserIsAdmin = sessionUser.role === "admin";
        const isSelf = params.id === session.userId
        
        // Only admins can update other users
        if (!sesionUserIsAdmin && session.userId !== params.id) {
            throw new errors.Forbidden();
        }
        
        const user = isSelf ? this.app.userManager.getUserWithoutPassword(params.id) : this.app.userManager.getUserPublic(params.id);
        return {
            user,
        };
    }
    
    private async createUser(req: Types.api.users.CreateUserRequest): Promise<Types.api.users.CreateUserResponse> {
        // First user must be an admin
        if (!this.app.userManager.hasAnyUsers() && req.role !== "admin") {
            throw new errors.BadRequest("firstUserMustBeAdmin");
        }
        
        const user = await this.app.userManager.createUser({
            login: req.login,
            plainPassword: req.password,
            role: req.role,
        });
        return {
            user,
        };
    }
    
    private async updateUser(params: Types.api.users.IdParams, req: Types.api.users.UpdateUserRequest, session: Session): Promise<Types.api.users.UpdateUserResponse> {
        const sessionUser = this.app.userManager.getUserById(session.userId)!;
        const updatedUser = this.app.userManager.getUserById(params.id);
        if (!updatedUser) {
            throw new errors.NotFound();
        }
        const isSelf = params.id === session.userId
        const sesionUserIsAdmin = sessionUser.role === "admin";
        
        // Only admins can update other users
        if (!sesionUserIsAdmin && session.userId !== params.id) {
            throw new errors.Forbidden("onlyAdminsCanUpdateOtherUsers");
        }
        
        // Only admins can update logins
        if (!sesionUserIsAdmin && req.login !== undefined && req.login !== updatedUser.login) {
            throw new errors.Forbidden("onlyAdminsCanUpdateLogins");
        }
        
        // Can't update own role
        if (req.role !== undefined && sessionUser.role !== req.role && sessionUser.id === params.id) {
            throw new errors.Forbidden("cantUpdateOwnRole");
        }
        
        // Can't update someone else's password
        if (req.password !== undefined && sessionUser.id !== params.id) {
            throw new errors.Forbidden("cantUpdateSomeoneElsesPassword");
        }
        
        // Can't update someone else's privateData
        if (req.privateData !== undefined && sessionUser.id !== params.id) {
            throw new errors.Forbidden("cantUpdateSomeoneElsesPrivateData");
        }
        
        await this.app.userManager.updateUser(params.id, {
            login: req.login,
            plainPassword: req.password,
            role: req.role,
            privateData: req.privateData,
        });
        
        const user = isSelf ? this.app.userManager.getUserWithoutPassword(params.id) : this.app.userManager.getUserPublic(params.id);
        return {
            user,
        };
    }
    
    private async deleteUser(params: Types.api.users.IdParams, _req: Types.api.users.DeleteUserRequest, session: Session): Promise<Types.api.users.DeleteUserResponse> {
        const currentUser = this.app.userManager.getUserById(session.userId);
        if (currentUser) {
            if (currentUser.id === params.id) {
                throw new errors.Forbidden("cantDeleteSelf");
            }
        }
        await this.app.userManager.deleteUser(params.id);
        return {
        };
    }
    
    private getMinUserRoleForUserCreation(): Types.data.user.Role {
        const hasAnyUser = this.app.userManager.hasAnyUsers();
        return hasAnyUser ? "admin" : "unauthorized";
    }
    
}
