const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');
const { createChallenge, verifyChallenge } = require('../src/controllers/walletController');
const { requireAuth, requireRole } = require('../src/middleware/auth');
const { verifyAccess } = require('../src/services/blockchainService');

let challengeRow;
let userWallet;
let walletOwnerUserId;
let linkedSigner;
let challengeConsumed = false;
const originalQuery = pool.query.bind(pool);
pool.query = async (sql, params) => {
  if (sql.includes('INSERT INTO wallet_link_challenges')) {
    challengeRow = { userId: params[0], wallet: params[1], nonce: params[2], message: params[3], expires: params[4] };
    challengeConsumed = false;
    return [{ insertId: 1 }];
  }
  if (sql.includes('SELECT challenge_id')) {
    return challengeRow && !challengeConsumed && params[0] === challengeRow.userId && params[1].toLowerCase() === challengeRow.wallet.toLowerCase() && params[2] === challengeRow.message
      ? [[{ challenge_id: 1, wallet_address: challengeRow.wallet, message: challengeRow.message }]]
      : [[]];
  }
  if (sql.includes('UPDATE wallet_link_challenges')) {
    if (challengeConsumed) return [{ affectedRows: 0 }];
    challengeConsumed = true;
    return [{ affectedRows: 1 }];
  }
  if (sql.includes('UPDATE users SET wallet_address')) {
    if (userWallet && walletOwnerUserId !== params[1]) {
      const err = new Error('duplicate'); err.code = 'ER_DUP_ENTRY'; throw err;
    }
    userWallet = params[0];
    walletOwnerUserId = params[1];
    return [{ affectedRows: 1 }];
  }
  throw new Error(`Unexpected query in test: ${sql}`);
};

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = { json: resolve };
    handler(req, res, reject);
  });
}

test('wallet challenge verifies ownership and is one-use', async () => {
  const wallet = ethers.Wallet.createRandom();
  linkedSigner = wallet;
  const issued = await invoke(createChallenge, { user: { userId: 81 }, body: { address: wallet.address } });
  const signature = await wallet.signMessage(issued.message);
  const linked = await invoke(verifyChallenge, { user: { userId: 81 }, body: { address: wallet.address, message: issued.message, signature } });
  assert.equal(linked.walletAddress.toLowerCase(), wallet.address.toLowerCase());
  await assert.rejects(
    invoke(verifyChallenge, { user: { userId: 81 }, body: { address: wallet.address, message: issued.message, signature } }),
    /challenge is missing, expired, or already used/
  );
});

test('wallet challenge rejects a signature from the wrong address', async () => {
  const intended = ethers.Wallet.createRandom();
  const other = ethers.Wallet.createRandom();
  const issued = await invoke(createChallenge, { user: { userId: 82 }, body: { address: intended.address } });
  const signature = await other.signMessage(issued.message);
  await assert.rejects(
    invoke(verifyChallenge, { user: { userId: 82 }, body: { address: intended.address, message: issued.message, signature } }),
    /does not prove ownership/
  );
});

test('wallet challenge rejects an address already linked to another account', async () => {
  const wallet = linkedSigner;
  const issued = await invoke(createChallenge, { user: { userId: 83 }, body: { address: wallet.address } });
  const signature = await wallet.signMessage(issued.message);
  await assert.rejects(
    invoke(verifyChallenge, { user: { userId: 83 }, body: { address: wallet.address, message: issued.message, signature } }),
    /already associated with another account/
  );
});

test('authentication rejects query-string bearer tokens', async () => {
  process.env.JWT_SECRET = 'unit-test-only-secret';
  const queryToken = jwt.sign({ userId: 1, role: 'MODERATOR' }, process.env.JWT_SECRET);
  const error = await new Promise((resolve) => requireAuth({ headers: {}, query: { token: queryToken } }, {}, resolve));
  assert.equal(error.statusCode, 401);
});

test('blockchain access fails closed when registry configuration is missing', async () => {
  const previousAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;
  delete process.env.BLOCKCHAIN_CONTRACT_ADDRESS;
  try {
    await assert.rejects(
      verifyAccess(1, 'a'.repeat(64), '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002', 'VIEW', false),
      (error) => error.statusCode === 503
    );
  } finally {
    if (previousAddress === undefined) delete process.env.BLOCKCHAIN_CONTRACT_ADDRESS;
    else process.env.BLOCKCHAIN_CONTRACT_ADDRESS = previousAddress;
  }
});

test('role middleware rejects accounts without the required role', async () => {
  const response = await new Promise((resolve) => requireRole('MODERATOR')({ user: { role: 'CONSUMER' } }, {}, resolve));
  assert.match(response.message, /not authorized/);
});

after(() => {
  pool.query = originalQuery;
});
