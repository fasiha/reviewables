"use strict";

function rubyfy(s) {
  var reg = /\[([^\]]+)\]\(([^\)]+)\)/g;
  var rubied =
      s.replace(reg, (_, base, ruby) => `<ruby>${base}<rt>${ruby}</rt></ruby>`);
  var baseOnly = s.replace(reg, (_, base) => `${base}`);
  return `${baseOnly}: ${rubied}`;
}

function rubyfyFileContents(all) {
  return all.replace(/\n- Ruby: (.*?)\n/g, (_, s) => `\n- ${rubyfy(s)}\n`);
}

function parseBracketedFormat(s, inner) {
  var pieces = [];
  while (1) {
    // Search for non-link prefix. If found, strip it.
    let plain = s.match(/^[^\[]+/);
    if (plain) {
      pieces.push(plain[0]);
      s = s.slice(plain[0].length);
    }
    // Guaranteed that the first character is either `[something in brackets]`
    // or empty.
    let furi = s.match(inner);
    if (!furi) {
      break;
    }
    pieces.push({ruby : furi[1], rt : furi[2]});
    s = s.slice(furi[0].length);
  }
  return pieces;
}

function parseJmdictFurigana(s) {
  // Like `[言;い]う`, per JmdictFurigana project
  return parseBracketedFormat(s, /^\[([^;]+);([^\]]+)\]/);
}
function parseMarkdownLinkRuby(s) {
  // Converts my "fake" Ruby syntax using Markdown links: `a[b](c)d`.
  return parseBracketedFormat(s, /^\[([^\]]+)\]\(([^)]+)\)/);
}
function furiganaStringToPlain(arr) {
  return arr.map(o => typeof(o) === 'string' ? o : o.ruby).join('');
}
function furiganaStringToReading(arr) {
  return arr.map(o => typeof(o) === 'string' ? o : o.rt).join('');
}

module.exports = {
  rubyfy,
  rubyfyFileContents,

  parseMarkdownLinkRuby,
  furiganaStringToPlain,
  furiganaStringToReading
};

if (require.main === module) {
  var fs = require('fs');
  var all = fs.readFileSync('README.md', 'utf8');
  console.log(rubyfyFileContents(all));
}
