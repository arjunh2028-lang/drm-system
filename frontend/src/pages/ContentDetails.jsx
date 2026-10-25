import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
  getContentDetails,
  listAllUsers,
  grantRight,
  revokeRight,
  verifyIntegrity,
  downloadContentFile,
  getContentViewFile,
  registerAssetOnBlockchain,
  getErrorMessage,
} from '../services/api';
import {
  ShieldCheck,
  ShieldAlert,
  Eye,
  Download,
  RefreshCw,
  Copy,
  Check,
  ArrowLeft,
  UserPlus,
  Trash2,
  FileText,
  Clock,
  HardDrive,
  Lock,
} from 'lucide-react';

const RIGHT_TYPES = ['VIEW', 'DOWNLOAD', 'SHARE'];

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function ContentDetails() {
  const { id } = useParams();
  const [content, setContent] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantRightType, setGrantRightType] = useState('VIEW');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantError, setGrantError] = useState('');

  const [integrity, setIntegrity] = useState(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [copiedHash, setCopiedHash] = useState('');
  const [registeringAsset, setRegisteringAsset] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getContentDetails(id)
      .then((res) => setContent(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    listAllUsers().then((res) => setUsers(res.data)).catch(() => {});
  }, [load]);

  const canManage = content && (content.isOwner || content.myRights.SHARE);
  const blockchainReady = !content?.blockchain?.status || ['LEGACY', 'CONFIRMED'].includes(content.blockchain.status);
  const protectedDeliveryReady = content?.encryptionStatus === 'ENCRYPTED' && blockchainReady;

  function handleCopy(text) {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(''), 2000);
  }

  async function handleGrant(e) {
    e.preventDefault();
    setGrantError('');
    if (!grantUserId) {
      setGrantError('Please select a user.');
      return;
    }
    setGrantSubmitting(true);
    try {
      await grantRight(id, {
        userId: Number(grantUserId),
        rightType: grantRightType,
        ...(grantExpiresAt ? { expiresAt: Math.floor(new Date(grantExpiresAt).getTime() / 1000) } : {}),
      });
      setShowGrantModal(false);
      setGrantUserId('');
      setGrantRightType('VIEW');
      setGrantExpiresAt('');
      setActionMessage('Right granted successfully.');
      load();
    } catch (err) {
      setGrantError(getErrorMessage(err));
    } finally {
      setGrantSubmitting(false);
    }
  }

  async function handleRevoke(rightId) {
    setError('');
    try {
      await revokeRight(id, rightId);
      setActionMessage('Right revoked successfully.');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleVerify() {
    setCheckingIntegrity(true);
    setIntegrity(null);
    try {
      const res = await verifyIntegrity(id);
      setIntegrity(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCheckingIntegrity(false);
    }
  }

  async function handleDownload() {
    try {
      const res = await downloadContentFile(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', content.originalFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleView() {
    const tab = window.open('', '_blank');
    try {
      const res = await getContentViewFile(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: res.data.type || 'application/octet-stream' }));
      if (tab) tab.location.href = url;
      else window.location.href = url;
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (tab) tab.close();
      setError(getErrorMessage(err));
    }
  }

  async function handleRegisterBlockchain() {
    setRegisteringAsset(true);
    setError('');
    try {
      await registerAssetOnBlockchain(id);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRegisteringAsset(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading asset details...</p>
      </div>
    );
  }

  if (error && !content) return <div className="alert alert-error">{error}</div>;
  if (!content) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/my-content" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.84rem', color: '#64748b', marginBottom: '8px' }}>
            <ArrowLeft size={14} /> Back to My Content
          </Link>
          <h1>{content.title}</h1>
          <p className="page-subtitle">
            Creator: <strong>{content.owner.name}</strong> ({content.owner.email})
          </p>
        </div>

        <div className="header-actions">
          {content.myRights.VIEW && content.viewSupported && protectedDeliveryReady && (
            <button className="btn btn-secondary" onClick={handleView}>
              <Eye size={16} /> View file
            </button>
          )}
          {content.myRights.DOWNLOAD && protectedDeliveryReady && (
            <button className="btn btn-buyer" onClick={handleDownload}>
              <Download size={16} /> Download File
            </button>
          )}
        </div>
      </div>

      {content.myRights.VIEW && (content.encryptionStatus !== 'ENCRYPTED' || !content.viewSupported) && (
        <div className="alert alert-error">
          {content.encryptionStatus !== 'ENCRYPTED'
            ? 'Protected preview is unavailable until this legacy asset is converted.'
            : 'Protected preview is unavailable for this file format. VIEW permission does not expose the original file; a separate DOWNLOAD permission is required.'}
        </div>
      )}
      {!blockchainReady && (content.myRights.VIEW || content.myRights.DOWNLOAD) && (
        <div className="alert alert-error">
          Protected access is blocked while blockchain registration is {content.blockchain.status.toLowerCase()}.
        </div>
      )}

      {actionMessage && <div className="alert alert-success">{actionMessage}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {content.encryptionStatus !== 'ENCRYPTED' && (
        <div className="alert alert-error">
          This is a legacy plaintext asset. Protected viewing and downloads are disabled until an administrator runs the verified legacy-content conversion.
        </div>
      )}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-header">
          <div>
            <h2>Blockchain asset record</h2>
            <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
              {content.blockchain?.status === 'CONFIRMED'
                ? `Registered on chain ${content.blockchain.chain_id}; transaction ${content.blockchain.registration_tx || 'reconciled'}`
                : content.blockchain?.status === 'PENDING'
                  ? 'Registration/license migration is pending. Blockchain-backed access is blocked until confirmation.'
                  : content.blockchain?.status === 'FAILED'
                    ? `Registration failed. Blockchain-backed access is blocked. ${content.blockchain.error_message || 'Retry after checking configuration.'}`
                    : 'Legacy asset: current database rights remain in effect until blockchain registration.'}
            </div>
          </div>
          {content.isOwner && content.blockchain?.status !== 'CONFIRMED' && (
            <button className="btn btn-creator btn-small" onClick={handleRegisterBlockchain} disabled={registeringAsset}>
              {registeringAsset ? 'Registering…' : content.blockchain?.status === 'FAILED' ? 'Retry registration' : content.blockchain?.status === 'PENDING' ? 'Retry stale registration' : 'Register on blockchain'}
            </button>
          )}
        </div>
        {content.blockchain?.registration_tx && (
          <div style={{ fontSize: '0.78rem', wordBreak: 'break-all', color: '#475569' }}>Transaction: {content.blockchain.registration_tx}</div>
        )}
        {content.blockchainOperations?.some((op) => op.database_sync_status !== 'SYNCED') && (
          <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>
            A blockchain license operation needs attention. Check its status, then retry the same grant or revoke action after resolving the displayed error.
          </div>
        )}
        {content.blockchainOperations?.slice(0, 3).map((op, index) => (
          <div key={`${op.created_at}-${index}`} style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 6 }}>
            {op.operation_type} {op.right_type}: {op.status} / DB {op.database_sync_status}
            {op.transaction_hash ? ` · ${op.transaction_hash.slice(0, 14)}…` : ''}
            {op.error_message ? ` · ${op.error_message}` : ''}
          </div>
        ))}
      </div>

      <div className="panel-grid">
        {/* File Metadata Card */}
        <div className="panel">
          <div className="panel-header">
            <h2>File Information</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Original Filename</div>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{content.originalFilename}</div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>File Size</div>
              <div style={{ fontWeight: 500, marginTop: '2px' }}>{formatBytes(content.fileSize)}</div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Uploaded Date</div>
              <div style={{ color: '#334155', marginTop: '2px' }}>{new Date(content.uploadTimestamp).toLocaleString()}</div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>At-rest protection</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>{content.encryptionStatus === 'ENCRYPTED' ? 'AES-256-GCM encrypted' : 'Legacy plaintext — conversion required'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Stored SHA-256 Digest</div>
              <div style={{ marginTop: '4px' }}>
                <button
                  className="hash-chip"
                  onClick={() => handleCopy(content.fileHash)}
                  title="Click to copy full SHA-256 hash"
                >
                  {copiedHash === content.fileHash ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  <span>{content.fileHash}</span>
                </button>
              </div>
            </div>

            <div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Your Permissions</div>
              <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {content.isOwner ? (
                  <span className="badge badge-active">FULL OWNER RIGHTS</span>
                ) : (
                  RIGHT_TYPES.filter((rt) => content.myRights[rt]).map((rt) => (
                    <span key={rt} className={`badge badge-${rt.toLowerCase()}`}>{rt}</span>
                  ))
                )}
                {!content.isOwner && RIGHT_TYPES.every((rt) => !content.myRights[rt]) && (
                  <span style={{ color: '#94a3b8' }}>No access rights</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Integrity Panel */}
        <div className="panel">
          <div className="panel-header">
            <h2>Cryptographic Integrity</h2>
            <button className="btn btn-secondary btn-small" onClick={handleVerify} disabled={checkingIntegrity}>
              <RefreshCw size={14} className={checkingIntegrity ? 'spin' : ''} />
              {checkingIntegrity ? 'Checking...' : 'Re-verify Hash'}
            </button>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '0 0 16px', lineHeight: 1.45 }}>
            Computes a SHA-256 digest from the stored file and compares it with the value recorded at upload. Blockchain-registered assets show their separate on-chain hash record above.
          </p>

          {integrity ? (
            <div
              style={{
                background: integrity.status === 'VERIFIED' ? '#f0fdf4' : '#fff1f2',
                border: integrity.status === 'VERIFIED' ? '1px solid #bbf7d0' : '1px solid #fecdd3',
                borderRadius: '8px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {integrity.status === 'VERIFIED' ? (
                  <ShieldCheck size={26} color="#16a34a" />
                ) : (
                  <ShieldAlert size={26} color="#e11d48" />
                )}
                <div>
                  <div style={{ fontWeight: 700, color: integrity.status === 'VERIFIED' ? '#15803d' : '#be123c' }}>
                    Status: {integrity.status}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                    {integrity.status === 'VERIFIED'
                      ? 'The file byte-stream matches the cryptographic digest exactly.'
                      : 'File bytes have been modified or corrupted!'}
                  </div>
                </div>
              </div>

              {integrity.currentHash && (
                <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#64748b' }}>
                  <strong>Live Computed Hash:</strong>
                  <div className="hash-chip" style={{ marginTop: '4px', width: '100%', wordBreak: 'break-all' }}>
                    {integrity.currentHash}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
              Click <strong>&quot;Re-verify Hash&quot;</strong> to audit physical storage integrity.
            </div>
          )}
        </div>
      </div>

      {/* Rights Management Matrix */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Digital Rights Management Matrix</h2>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Active and historical rights granted to users for this asset.
            </div>
          </div>
          {canManage && (
            <button className="btn btn-creator btn-small" onClick={() => setShowGrantModal(true)}>
              <UserPlus size={15} /> Grant Right
            </button>
          )}
        </div>

        {content.rights.length === 0 ? (
          <p className="muted">No rights have been granted on this content yet.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Recipient User</th>
                  <th>Right Type</th>
                  <th>Granted By</th>
                  <th>Granted On</th>
                  <th>Expires</th>
                  <th>Blockchain transaction</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {content.rights.map((r) => (
                  <tr key={r.right_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.user_name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.user_email}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${r.right_type.toLowerCase()}`}>{r.right_type}</span>
                    </td>
                    <td>{r.granted_by_name}</td>
                    <td>{new Date(r.granted_timestamp).toLocaleDateString()}</td>
                    <td>{r.license_expires_at ? new Date(Number(r.license_expires_at) * 1000).toLocaleString() : (content.blockchain?.status === 'CONFIRMED' ? 'Never' : '—')}</td>
                    <td>
                      {r.blockchain_transaction_hash ? (
                        <code title={r.blockchain_transaction_hash} style={{ fontSize: '0.74rem' }}>
                          {r.blockchain_transaction_hash.slice(0, 12)}…
                        </code>
                      ) : 'Legacy'}
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'ACTIVE' ? 'badge-active' : 'badge-revoked'}`}>
                        {r.status}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        {r.status === 'ACTIVE' && (
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => handleRevoke(r.right_id)}
                            title="Revoke this user's rights"
                          >
                            <Trash2 size={13} /> Revoke
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grant Rights Modal */}
      {showGrantModal && (
        <Modal title="Grant Digital Right" onClose={() => setShowGrantModal(false)}>
          <form onSubmit={handleGrant}>
            {grantError && <div className="alert alert-error">{grantError}</div>}

            <label className="field-label">Select User</label>
            <select
              className="select"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              required
            >
              <option value="">Select recipient...</option>
              {users
                .filter((u) => u.id !== content.owner.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>

            {content.blockchain?.status === 'CONFIRMED' && (
              <>
                <label className="field-label">Expiration (optional)</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={grantExpiresAt}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={(e) => setGrantExpiresAt(e.target.value)}
                />
              </>
            )}

            <label className="field-label">Permission Type</label>
            <select
              className="select"
              value={grantRightType}
              onChange={(e) => setGrantRightType(e.target.value)}
            >
              <option value="VIEW">VIEW (Read-only viewing in browser)</option>
              <option value="DOWNLOAD">DOWNLOAD (Permission to download the original file)</option>
              <option value="SHARE">SHARE (Permission to re-grant access to other users)</option>
            </select>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowGrantModal(false)}>
                Cancel
              </button>
              <button className="btn btn-creator" type="submit" disabled={grantSubmitting}>
                {grantSubmitting ? 'Granting...' : 'Grant Access'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
