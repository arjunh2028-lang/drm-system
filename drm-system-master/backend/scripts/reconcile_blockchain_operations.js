require('dotenv').config();
const { pool } = require('../src/config/db');
const { getRegistry, RIGHT_IDS } = require('../src/services/blockchainService');

async function main() {
  const { contract, provider } = getRegistry();
  const [operations] = await pool.query(
    `SELECT operation_id, content_id, right_id, actor_user_id, operation_type, wallet_address, right_type, expiration_timestamp
     FROM blockchain_operations WHERE (status = 'CONFIRMED' AND database_sync_status IN ('PENDING', 'FAILED'))
       OR (status = 'PENDING' AND transaction_hash IS NOT NULL)
     ORDER BY operation_id`
  );
  const result = { inspected: operations.length, reconciled: 0, skipped: 0, failures: [] };
  for (const op of operations) {
    const connection = await pool.getConnection();
    try {
      const [stored] = await pool.query('SELECT transaction_hash, block_number FROM blockchain_operations WHERE operation_id = ?', [op.operation_id]);
      if (stored[0]?.transaction_hash) {
        const receipt = await provider.getTransactionReceipt(stored[0].transaction_hash);
        if (!receipt) { result.skipped++; continue; }
        if (receipt.status !== 1) {
          await pool.query("UPDATE blockchain_operations SET status = 'FAILED', database_sync_status = 'FAILED', block_number = ?, error_message = 'Transaction receipt indicates a revert' WHERE operation_id = ?", [receipt.blockNumber, op.operation_id]);
          result.reconciled++;
          continue;
        }
        const depth = await provider.getBlockNumber() - receipt.blockNumber + 1;
        if (depth < Number(process.env.BLOCKCHAIN_CONFIRMATIONS || 1)) { result.skipped++; continue; }
        await pool.query("UPDATE blockchain_operations SET status = 'CONFIRMED', block_number = ? WHERE operation_id = ?", [receipt.blockNumber, op.operation_id]);
      }
      const license = await contract.licenses(op.content_id, op.wallet_address, RIGHT_IDS[op.right_type]);
      const existsAndUnrevoked = license.issuedAt > 0n && !license.revoked;
      if (op.operation_type === 'GRANT' && !existsAndUnrevoked) { result.skipped++; continue; }
      if (op.operation_type === 'REVOKE' && !license.revoked && license.issuedAt > 0n) { result.skipped++; continue; }
      const [recipients] = await pool.query('SELECT user_id FROM users WHERE LOWER(wallet_address) = LOWER(?)', [op.wallet_address]);
      const [owners] = await pool.query('SELECT owner_id FROM content WHERE content_id = ?', [op.content_id]);
      const recipientId = recipients[0]?.user_id;
      let rightId = op.right_id;
      if (!rightId && recipientId) {
        const [existing] = await pool.query('SELECT right_id FROM rights WHERE content_id = ? AND user_id = ? AND right_type = ?', [op.content_id, recipientId, op.right_type]);
        rightId = existing[0]?.right_id;
      }
      if (!rightId && op.operation_type === 'REVOKE') { result.skipped++; continue; }
      await connection.beginTransaction();
      if (op.operation_type === 'GRANT') {
        if (!rightId && recipientId && (op.actor_user_id || owners[0]?.owner_id)) {
          const [inserted] = await connection.query("INSERT INTO rights (content_id, user_id, right_type, granted_by, status) VALUES (?, ?, ?, ?, 'ACTIVE')", [op.content_id, recipientId, op.right_type, op.actor_user_id || owners[0].owner_id]);
          rightId = inserted.insertId;
        }
        if (!rightId) { await connection.rollback(); result.skipped++; continue; }
        await connection.query("UPDATE rights SET status = 'ACTIVE', revoked_by = NULL, revoked_timestamp = NULL WHERE right_id = ?", [rightId]);
        await connection.query(
          `INSERT INTO blockchain_rights (right_id, expiration_timestamp, transaction_hash, status)
           SELECT ?, expiration_timestamp, transaction_hash, 'CONFIRMED' FROM blockchain_operations WHERE operation_id = ?
           ON DUPLICATE KEY UPDATE expiration_timestamp = VALUES(expiration_timestamp), transaction_hash = COALESCE(VALUES(transaction_hash), transaction_hash), status = 'CONFIRMED', error_message = NULL`,
          [rightId, op.operation_id]
        );
      } else {
        await connection.query("UPDATE rights SET status = 'REVOKED', revoked_timestamp = CURRENT_TIMESTAMP WHERE right_id = ?", [rightId]);
        await connection.query("UPDATE blockchain_rights SET status = 'CONFIRMED', error_message = NULL WHERE right_id = ?", [rightId]);
      }
      await connection.query("UPDATE blockchain_operations SET right_id = COALESCE(right_id, ?), status = 'CONFIRMED', database_sync_status = 'SYNCED', error_message = NULL WHERE operation_id = ?", [rightId, op.operation_id]);
      await connection.commit();
      result.reconciled++;
    } catch (err) {
      await connection.rollback().catch(() => {});
      result.failures.push({ operationId: op.operation_id, reason: err.message });
    } finally {
      connection.release();
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Blockchain reconciliation failed to start:', err.message);
  process.exitCode = 1;
}).finally(async () => pool.end());
