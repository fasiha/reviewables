export default function fullwidthToHalf(word: string): string {
  return word.replace(/[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]/g,
      function(s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0); });
}
// via https://github.com/sengokyu/angular-convertjp/blob/c3cf8df20cfa396bddd9d68e30fa5d83367f5bc9/angular-convert-jp.js