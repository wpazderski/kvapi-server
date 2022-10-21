import { EndpointError } from "./EndpointError";
import { StatusTexts } from "./StatusTexts";

export class InternalServerError extends EndpointError {
    
    constructor(details: any) {
        super(500, StatusTexts[500], details);
    }
    
}
