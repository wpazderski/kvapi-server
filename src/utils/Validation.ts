import * as errors from "../errors";

export class Validation {
    
    static stringType(obj: any, target: string): void {
        if (typeof(obj) !== "string") {
            throw new errors.BadRequest({ target, validator: "stringType", params: { obj }});
        }
    }
    
    static numberType(obj: any, target: string): void {
        if (typeof(obj) !== "number") {
            throw new errors.BadRequest({ target, validator: "numberType", params: { obj }});
        }
    }
    
    static minLength(str: string, minLength: number, target: string, optional: boolean = false, trim: boolean = true): void {
        if (str && trim) {
            str = str.trim();
        }
        if (!str && optional) {
            return;
        }
        if (str.length < minLength) {
            throw new errors.BadRequest({ target, validator: "minLength", params: { str, minLength, optional, trim }});
        }
    }
    
    static maxLength(str: string, maxLength: number, target: string): void {
        if (str.length > maxLength) {
            throw new errors.BadRequest({ target, validator: "maxLength", params: { str, maxLength }});
        }
    }
    
    static min(num: number, min: number, target: string): void {
        if (num < min) {
            throw new errors.BadRequest({ target, validator: "min", params: { value: min, minValue: min }});
        }
    }
    
    static max(num: number, max: number, target: string): void {
        if (num > max) {
            throw new errors.BadRequest({ target, validator: "max", params: { value: num, maxValue: max }});
        }
    }
    
    static regex(str: string, regex: RegExp, target: string): void {
        if (!str.match(regex)) {
            throw new errors.BadRequest({ target, validator: "regex", params: { str, regex: regex.toString() }});
        }
    }
    
}
