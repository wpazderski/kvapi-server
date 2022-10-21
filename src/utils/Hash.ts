import * as crypto from "crypto";

export class Hash {
    
    static sha512(text: string): string {
        const cryptoHash = crypto.createHash("sha512");
        const data = cryptoHash.update(text, "utf-8");
        const hash = data.digest("hex");
        return hash;
    }
    
}
