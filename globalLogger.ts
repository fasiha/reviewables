var fs = require('fs');
var util = require('util');
var mkdirp = require('mkdirp');
export default async function logReview(result: any, thisComputer: string) {
    const now = new Date();
    const nowStr = now.toISOString().replace(/:/g, '_');
    const dir = 'reviews';
    const filename = `${dir}/review-${nowStr}-${thisComputer}.json`;
    await util.promisify(mkdirp)(dir);
    util.promisify(fs.writeFile)(filename, JSON.stringify(result, null, 1));
}
