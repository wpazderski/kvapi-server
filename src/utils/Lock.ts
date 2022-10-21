import { Deferred } from "./Deferred";

export class Lock {
    
    private promise: Promise<void> = Promise.resolve();
    private deferred: Deferred<void> | null = null;
    
    constructor() {
    }
    
    async obtain(): Promise<void> {
        const prevPromise = this.promise;
        const deferred = new Deferred<void>();
        this.promise = prevPromise.then(() => deferred.getPromise());
        await prevPromise;
        this.deferred = deferred;
    }
    
    free(): void {
        if (this.deferred) {
            this.deferred.resolve();
            this.deferred = null;
        }
    }
    
    async withLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.obtain();
        try {
            return await fn();
        }
        catch (err) {
            throw err;
        }
        finally {
            this.free();
        }
    }
    
}
