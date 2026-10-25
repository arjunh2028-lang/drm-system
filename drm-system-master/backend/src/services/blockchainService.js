const path = require('path');
const { ethers } = require('ethers');
const ApiError = require('../utils/ApiError');

const artifactPath = path.resolve(__dirname, '../../../blockchain/artifacts/contracts/DRMRegistry.sol/DRMRegistry.json');
const RIGHT_IDS = Object.freeze({ VIEW: ethers.id('VIEW'), DOWNLOAD: ethers.id('DOWNLOAD'), SHARE: ethers.id('SHARE') });

function getNetworkConfig() {
  const chainId = Number(process.env.BLOCKCHAIN_CHAIN_ID || 31337);
  const address = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  return { chainId, address, rpcUrl };
}

function getRegistry({ write = false } = {}) {
  const { address, rpcUrl, chainId } = getNetworkConfig();
  const privateKey = process.env.BLOCKCHAIN_ISSUER_PRIVATE_KEY;
  if (!address || !ethers.isAddress(address)) throw new ApiError(503, 'Blockchain registry is not configured.');
  let artifact;
  try { artifact = require(artifactPath); } catch (_) { throw new ApiError(503, 'Blockchain contract artifacts are missing. Run the contract compile command.'); }
  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
  const runner = write
    ? (privateKey ? new ethers.Wallet(privateKey, provider) : null)
    : provider;
  if (write && !runner) throw new ApiError(503, 'Blockchain issuer is not configured.');
  return { contract: new ethers.Contract(address, artifact.abi, runner), provider, ...getNetworkConfig() };
}

async function submitAndConfirm(txPromise, onSubmitted = null) {
  const tx = await txPromise;
  if (onSubmitted) await onSubmitted({ hash: tx.hash });
  const receipt = await tx.wait(Number(process.env.BLOCKCHAIN_CONFIRMATIONS || 1));
  if (!receipt || receipt.status !== 1) throw new Error('Blockchain transaction was not confirmed successfully.');
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
}

function toHashBytes(fileHash) {
  if (!/^[a-fA-F0-9]{64}$/.test(fileHash || '')) throw new ApiError(400, 'Stored content hash is not a valid SHA-256 digest.');
  return `0x${fileHash.toLowerCase()}`;
}

async function registerAsset(contentId, fileHash, ownerWallet) {
  if (!ethers.isAddress(ownerWallet)) throw new ApiError(400, 'A verified owner wallet is required.');
  const { contract } = getRegistry({ write: true });
  const hash = toHashBytes(fileHash);
  const existing = await contract.assets(contentId);
  if (existing.registered) {
    if (existing.contentHash.toLowerCase() !== hash.toLowerCase() || existing.owner.toLowerCase() !== ownerWallet.toLowerCase()) {
      throw new ApiError(409, 'On-chain asset record conflicts with the current content hash or owner wallet.');
    }
    return { hash: null, blockNumber: null, alreadyRegistered: true };
  }
  return submitAndConfirm(contract.registerAsset(contentId, hash, ownerWallet));
}

async function grantLicense(contentId, wallet, rightType, expiresAt = 0, onSubmitted = null) {
  const rightId = RIGHT_IDS[rightType];
  if (!rightId) throw new ApiError(400, 'Unsupported license right type.');
  const { contract } = getRegistry({ write: true });
  return submitAndConfirm(contract.grantLicense(contentId, wallet, rightId, expiresAt), onSubmitted);
}

async function revokeLicense(contentId, wallet, rightType, onSubmitted = null) {
  const rightId = RIGHT_IDS[rightType];
  if (!rightId) throw new ApiError(400, 'Unsupported license right type.');
  const { contract } = getRegistry({ write: true });
  const license = await contract.licenses(contentId, wallet, rightId);
  if (license.issuedAt === 0n || license.revoked) return { hash: null, alreadyInactive: true };
  return submitAndConfirm(contract.revokeLicense(contentId, wallet, rightId), onSubmitted);
}

async function verifyAccess(contentId, fileHash, ownerWallet, userWallet, rightType, isOwner) {
  try {
    const { contract } = getRegistry();
    const asset = await contract.assets(contentId);
    if (!asset.registered || asset.contentHash.toLowerCase() !== toHashBytes(fileHash).toLowerCase() || asset.owner.toLowerCase() !== ownerWallet.toLowerCase()) {
      return false;
    }
    if (isOwner) return await contract.isAssetOwner(contentId, userWallet);
    const rightId = RIGHT_IDS[rightType];
    return rightId ? await contract.isLicenseValid(contentId, userWallet, rightId) : false;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(503, 'Blockchain state could not be verified; access is unavailable until the registry responds.');
  }
}

module.exports = { RIGHT_IDS, getNetworkConfig, getRegistry, submitAndConfirm, registerAsset, grantLicense, revokeLicense, verifyAccess };
