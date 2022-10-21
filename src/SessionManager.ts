import * as Types from "@wpazderski/kvapi-types";
import { App } from "./App";
import { Db } from "./db/Db";
import { Random } from "./utils/Random";

export interface Session {
    id: Types.data.session.Id;
    userId: Types.data.user.Id;
    startDateTime: Date;
    lastActivityDateTime: Date;
    userPrivateDb: Db | null;
}

export class SessionManager {
    
    private static readonly CLEANUP_INTERVAL_MS: number = 5 * 60 * 1000;
    private static readonly SESSION_ID_LENGTH: number = 64;
    
    
    
    
    
    private sessions: Session[] = [];
    private sessionMaxInactivityTime: number;
    
    constructor(private app: App) {
        this.sessionMaxInactivityTime = this.app.appConfig.sessionMaxInactivityTime;
        this.startCleanupInterval();
    }
    
    async init(): Promise<void> {
    }
    
    getSessionById(sessionId: Types.data.session.Id): Session | null {
        const session = this.sessions.find(session => session.id === sessionId);
        return session ? session : null;
    }
    
    
    
    
    
    //////////////////////////////////////////////////
    // Session expiration / termination / cleanup
    //////////////////////////////////////////////////
    private startCleanupInterval(): void {
        setInterval(() => this.cleanupExpiredSessions(), SessionManager.CLEANUP_INTERVAL_MS);
    }
    
    private cleanupExpiredSessions(): void {
        for (const session of this.sessions) {
            if (this.isSessionExpired(session)) {
                this.terminateSession(session);
            }
        }
    }
    
    private isSessionExpired(session: Session): boolean {
        const elapsedMs = Date.now() - session.lastActivityDateTime.getTime();
        return elapsedMs > this.sessionMaxInactivityTime;
    }
    
    private terminateSession(session: Session): void {
        const idx = this.sessions.indexOf(session);
        if (idx < 0) {
            console.error("SessionManager.terminateSession(): session doesn't exist");
            return;
        }
        this.sessions.splice(idx, 1);
    }
    
    terminateSessionById(sessionId: Types.data.session.Id): void {
        const session = this.getSessionById(sessionId);
        if (session) {
            this.terminateSession(session);
        }
    }
    
    terminateSessionsByUserId(userId: Types.data.user.Id): void {
        const sessions = this.sessions.filter(session => session.userId === userId);
        for (const session of sessions) {
            this.terminateSession(session);
        }
    }
    
    updateSessionLastActivity(sessionId: Types.data.session.Id): void {
        const session = this.getSessionById(sessionId);
        if (session) {
            session.lastActivityDateTime = new Date();
        }
    }
    
    terminateAllSessions(): void {
        const sessions = [...this.sessions];
        for (const session of sessions) {
            this.terminateSession(session);
        }
    }
    
    
    
    
    
    //////////////////////////////////////////////////
    // Session creation
    //////////////////////////////////////////////////
    createSession(userId: Types.data.user.Id): Session {
        this.terminateSessionsByUserId(userId);
        const session = this.createSessionObject(userId);
        this.sessions.push(session);
        return session;
    }
    
    private createSessionObject(userId: Types.data.user.Id): Session {
        const nowDateTime = new Date();
        const session: Session = {
            id: this.generateSessionId(),
            userId: userId,
            startDateTime: nowDateTime,
            lastActivityDateTime: nowDateTime,
            userPrivateDb: this.app.mainDb.getUserPrivateSubDb(userId, this.app.appConfig),
        };
        return session;
    }
    
    private generateSessionId(): Types.data.session.Id {
        return Random.generateString(SessionManager.SESSION_ID_LENGTH) as Types.data.session.Id;
    }
    
    getEmptySession(): Session {
        const nowDateTime = new Date();
        return {
            id: "" as Types.data.session.Id,
            userId: "" as Types.data.user.Id,
            startDateTime: nowDateTime,
            lastActivityDateTime: nowDateTime,
            userPrivateDb: null,
        };
    }
    
}
