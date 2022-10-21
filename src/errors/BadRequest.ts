import { EndpointError } from "./EndpointError";
import { StatusTexts } from "./StatusTexts";

export class BadRequest extends EndpointError {
    
    constructor(details: any) {
        super(400, StatusTexts[400], details);
    }
    
}
