const crypto = require('crypto');
const { ethers } = require('ethers');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logSecurityEvent } = require('../services/securityAuditService');

const walletStatus = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT wallet_address FROM users WHERE user_id = ?', [req.user.userId]);
  res.json({ walletAddress: rows[0]?.wallet_address || null });
});

const createChallenge = asyncHandler(async (req, res) => {
  const { address } = req.body;
  if (!ethers.isAddress(address || '')) {
    await logSecurityEvent({ req, eventType: 'WALLET_CHALLENGE_FAILED', detail: 'Malformed wallet address submitted' });
    throw new ApiError(400, 'A valid EVM wallet address is required.');
  }
  const walletAddress = ethers.getAddress(address);
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const message = `DRM wallet association\nAccount: ${req.user.userId}\nWallet: ${walletAddress}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;
  await pool.query(
    'INSERT INTO wallet_link_challenges (user_id, wallet_address, nonce, message, expires_at) VALUES (?, ?, ?, ?, ?)',
    [req.user.userId, walletAddress, nonce, message, expiresAt]
  );
  res.json({ address: walletAddress, message, expiresAt });
});

const verifyChallenge = asyncHandler(async (req, res) => {
  const { address, message, signature } = req.body;
  if (!ethers.isAddress(address || '') || typeof message !== 'string' || typeof signature !== 'string') {
    await logSecurityEvent({ req, eventType: 'WALLET_VERIFICATION_FAILED', detail: 'Malformed wallet verification request' });
    throw new ApiError(400, 'Address, challenge message and wallet signature are required.');
  }
  const walletAddress = ethers.getAddress(address);
  const [rows] = await pool.query(
    `SELECT challenge_id, wallet_address, message FROM wallet_link_challenges
     WHERE user_id = ? AND wallet_address = ? AND message = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     ORDER BY challenge_id DESC LIMIT 1`,
    [req.user.userId, walletAddress, message]
  );
  if (!rows.length) {
    await logSecurityEvent({ req, eventType: 'WALLET_CHALLENGE_FAILED', detail: 'Challenge missing, expired, or consumed' });
    throw new ApiError(400, 'Wallet challenge is missing, expired, or already used.');
  }

  let recovered;
  try { recovered = ethers.verifyMessage(rows[0].message, signature); } catch (_) {
    await logSecurityEvent({ req, eventType: 'WALLET_SIGNATURE_FAILED', detail: 'Signature could not be verified' });
    throw new ApiError(400, 'Wallet signature is invalid.');
  }
  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    await logSecurityEvent({ req, eventType: 'WALLET_SIGNATURE_FAILED', detail: 'Recovered signer did not match challenge wallet' });
    throw new ApiError(400, 'Signature does not prove ownership of the requested wallet.');
  }

  const [consume] = await pool.query(
    'UPDATE wallet_link_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE challenge_id = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP',
    [rows[0].challenge_id]
  );
  if (consume.affectedRows !== 1) throw new ApiError(409, 'Wallet challenge was already consumed.');
  try {
    const [updated] = await pool.query(
      'UPDATE users SET wallet_address = ? WHERE user_id = ? AND (wallet_address IS NULL OR wallet_address = ?)',
      [walletAddress, req.user.userId, walletAddress]
    );
    if (!updated.affectedRows) throw new ApiError(409, 'This account already has a different wallet linked.');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'This wallet is already associated with another account.');
    throw err;
  }
  res.json({ walletAddress });
});

module.exports = { walletStatus, createChallenge, verifyChallenge };
