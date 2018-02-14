export default function dedupeViaSets<T>(arr: T[]): T[] {
  let ret: T[] = [];
  let retset: Set<T> = new Set([]);
  for (const x of arr) {
    if (!retset.has(x)) {
      ret.push(x);
      retset.add(x);
    }
  }
  return ret;
}