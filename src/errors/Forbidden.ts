import { EndpointError } from "./EndpointError";
import { StatusTexts } from "./StatusTexts";

export class Forbidden extends EndpointError {
    
    constructor(details: any = null) {
        super(403, StatusTexts[403], details);
    }
    
}
