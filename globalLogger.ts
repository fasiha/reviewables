var fs = require('fs');
var util = require('util');
var mkdirp = require('mkdirp');
export default async function logReview(result: any, thisUser: string, thisComputer: string) {
    const now = new Date();
    const nowStr = now.toISOString().replace(/:/g, '_');
    thisUser = thisUser || 'reviews';
    const filename = `${thisUser}/review-${nowStr}-${thisComputer}.json`;
    await util.promisify(mkdirp)(thisUser);
    util.promisify(fs.writeFile)(filename, JSON.stringify(result, null, 1));
}
