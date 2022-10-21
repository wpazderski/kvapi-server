import * as crypto from "crypto";

export class Random {
    
    static generateString(length: number): string {
        const numBytes = Math.ceil(length / 2);
        const randomString = crypto.randomBytes(numBytes).toString("hex");
        const trimmedRandomString = randomString.substring(0, length);
        return trimmedRandomString;
    }
    
}

