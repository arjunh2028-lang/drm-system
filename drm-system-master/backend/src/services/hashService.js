const crypto = require('crypto');
const fs = require('fs');

// Streams the file so even fairly large uploads don't need to be
// loaded fully into memory just to hash them.
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = { sha256File };
