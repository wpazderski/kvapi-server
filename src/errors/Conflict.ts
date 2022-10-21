import { EndpointError } from "./EndpointError";
import { StatusTexts } from "./StatusTexts";

export class Conflict extends EndpointError {
    
    constructor(details: any) {
        super(409, StatusTexts[409], details);
    }
    
}
