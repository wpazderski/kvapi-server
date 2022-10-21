import { EndpointError } from "./EndpointError";
import { StatusTexts } from "./StatusTexts";

export class Unauthorized extends EndpointError {
    
    constructor(details: any = null) {
        super(401, StatusTexts[401], details);
    }
    
}
