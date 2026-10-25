function classifyRecovery(operation) {
  if (!operation?.transaction_hash) return { action: 'manual_review', reason: 'No transaction hash is recorded; current contract state cannot safely identify which operation caused it.' };
  return { action: 'inspect_receipt' };
}

module.exports = { classifyRecovery };
