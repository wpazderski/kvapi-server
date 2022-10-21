export class EndpointError extends Error {
    
    constructor(protected statusCode: number, protected statusText: string, protected details: any) {
        super();
    }
    
    getStatusCode(): number {
        return this.statusCode;
    }
    
    getStatusMessage(): string {
        return this.statusText;
    }
    
    getDetails(): any {
        return this.details;
    }
    
}
