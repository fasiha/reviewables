module.exports = function cliPrompt() {
  return new Promise((resolve, reject) => {
    var stdin = process.stdin, stdout = process.stdout;
    stdin.resume();
    stdout.write('> ');
    stdin.once('data', data => {
      resolve(data.toString().trim());
      stdin.pause();
    });
  });
}
