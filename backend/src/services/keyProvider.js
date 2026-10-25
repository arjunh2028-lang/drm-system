const KEY_BYTES = 32;
const VERSION_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

function activeVersion() {
  const version = process.env.CONTENT_KEK_VERSION || 'v1';
  if (!VERSION_PATTERN.test(version)) throw new Error('CONTENT_KEK_VERSION must be a short alphanumeric version identifier.');
  return version;
}

function decodeKey(encoded, version) {
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error(`A base64 32-byte KEK must be configured for version ${version}.`);
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES || key.toString('base64') !== encoded) throw new Error(`KEK version ${version} must decode to exactly 32 bytes.`);
  return key;
}

// Local development provider. A managed KMS can implement this same interface
// without changing encryption or rotation callers.
const environmentKeyProvider = Object.freeze({
  getActiveVersion: activeVersion,
  getKey(version) {
    if (!VERSION_PATTERN.test(version || '')) throw new Error('Invalid KEK version identifier.');
    const variableName = `CONTENT_KEK_${version.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_BASE64`;
    const legacy = version === 'v1' ? process.env.CONTENT_KEK_BASE64 : undefined;
    return decodeKey(process.env[variableName] || legacy, version);
  },
});

let configuredProvider = environmentKeyProvider;
function setKeyProvider(provider) {
  if (!provider || typeof provider.getActiveVersion !== 'function' || typeof provider.getKey !== 'function') {
    throw new Error('Key provider must implement getActiveVersion() and getKey(version).');
  }
  configuredProvider = provider;
}
function resetKeyProvider() { configuredProvider = environmentKeyProvider; }
function getActiveVersion() { return configuredProvider.getActiveVersion(); }
function getKey(version = getActiveVersion()) {
  const key = configuredProvider.getKey(version);
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new Error(`Key provider returned an invalid key for version ${version}.`);
  return key;
}
function validateConfiguration() { getKey(getActiveVersion()); }

module.exports = { environmentKeyProvider, getActiveVersion, getKey, setKeyProvider, resetKeyProvider, validateConfiguration };
