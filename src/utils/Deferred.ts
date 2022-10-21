export class Deferred<T> {
    
    private promise: Promise<T>;
    // @ts-ignore
    resolve: (value: T) => void;
    // @ts-ignore
    reject: (reason: any) => void;
    
    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
    
    getPromise(): Promise<T> {
        return this.promise;
    }
    
}
