import * as Types from "@wpazderski/kvapi-types";
import { App } from "../App";
import { Session } from "../SessionManager";
import { ApiEndpointGroup } from "./Api";

export class Batch implements ApiEndpointGroup {
    
    constructor(private app: App) {
        this.app.api.registerEndpoint("post", "batch", (_params, req, session) => this.processBatchRequest(req as Types.api.batch.Request, session), "unauthorized");
    }
    
    async processBatchRequest(req: Types.api.batch.Request, session: Session): Promise<Types.api.batch.Response> {
        const responses: Types.api.batch.BatchedResponse[] = [];
        for (const request of req.batchedRequests) {
            const response = await this.processBatchedRequest(request, session);
            responses.push(response);
        }
        return {
            batchedResponses: responses,
        };
    }
    
    async processBatchedRequest(request: Types.api.batch.BatchedRequest, session: Session): Promise<Types.api.batch.BatchedResponse> {
        return this.app.api.handleBatchedRequest(request, session);
    }
    
}
