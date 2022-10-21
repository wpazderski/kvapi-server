import { EndpointError } from "./EndpointError";
import { StatusTexts } from "./StatusTexts";

export class NotFound extends EndpointError {
    
    constructor(details: any = null) {
        super(404, StatusTexts[404], details);
    }
    
}
