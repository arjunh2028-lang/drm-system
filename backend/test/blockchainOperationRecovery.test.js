const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRecovery } = require('../src/services/blockchainOperationRecovery');

test('operation without a stored hash is surfaced for manual review, never inferred as success', () => {
  const result = classifyRecovery({ operation_id: 12, operation_type: 'GRANT', transaction_hash: null });
  assert.equal(result.action, 'manual_review');
  assert.match(result.reason, /cannot safely identify/);
});

test('operation with a stored hash is sent through receipt verification', () => {
  assert.deepEqual(classifyRecovery({ transaction_hash: `0x${'a'.repeat(64)}` }), { action: 'inspect_receipt' });
});
