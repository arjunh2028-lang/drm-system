const { rewrapDek } = require('./encryptionService');

function rotateWrappedKey(metadata, sourceKek, targetKek, targetVersion) {
  if (!metadata || !metadata.keyVersion) throw new Error('Wrapped key metadata has no KEK version.');
  if (metadata.keyVersion === targetVersion) return { changed: false, metadata };
  const rotated = rewrapDek(metadata, sourceKek, targetKek, targetVersion);
  return { changed: true, metadata: rotated };
}

module.exports = { rotateWrappedKey };
