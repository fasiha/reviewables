"use strict";
import * as assert from "assert";
var bs = require("binary-search");
export default function closestButNotOver<T, U>(arr: T[],
    i: U,
    cmp?: (a: T, b: U, index?: number, haystack?: T[]) => number,
    skipCheck?: boolean): T | null {
    cmp = cmp || ((a: any, b: any) => a - b);
    if (!skipCheck) {
        for (let i = 1; i < arr.length; i++) {
            if (cmp(arr[i], arr[i - 1] as any) < 0) {
                assert(false, 'sorted array required');
            }
        }
    }
    var hit = bs(arr, i, cmp);
    if (hit >= 0) {
        return arr[hit];
    } else if (hit === -1) {
        return null;
    }
    return arr[-hit - 2];
};