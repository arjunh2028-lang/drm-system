import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  FileText,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { getModeratorAllContent, verifyAllIntegrity, getErrorMessage } from '../services/api';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function ModeratorOverview() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Global Integrity Scan
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [copiedHash, setCopiedHash] = useState('');

  function loadData() {
    setLoading(true);
    getModeratorAllContent()
      .then((res) => setItems(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleScanAll() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await verifyAllIntegrity();
      setScanResult(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  function handleCopy(hash) {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(''), 2000);
  }

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.original_filename.toLowerCase().includes(q) ||
      item.owner_name.toLowerCase().includes(q) ||
      item.owner_email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="role-auth-banner role-badge-moderator-banner" style={{ marginBottom: '8px' }}>
            <ShieldAlert size={15} /> Moderator System Control
          </div>
          <h1>Platform Governance & Asset Registry</h1>
          <p className="page-subtitle">
            System-wide oversight across all creators, rights distribution, and batch cryptographic integrity auditing.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-moderator"
            onClick={handleScanAll}
            disabled={scanning}
          >
            <RefreshCw size={16} className={scanning ? 'spin' : ''} />
            {scanning ? 'Auditing Platform Assets...' : 'Run Global Integrity Scan'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Global Integrity Scan Result Banner */}
      {scanResult && (
        <div
          className="panel"
          style={{
            background: scanResult.modifiedCount === 0 && scanResult.missingCount === 0 ? '#f0fdf4' : '#fff1f2',
            borderColor: scanResult.modifiedCount === 0 && scanResult.missingCount === 0 ? '#bbf7d0' : '#fecdd3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {scanResult.modifiedCount === 0 && scanResult.missingCount === 0 ? (
                <ShieldCheck size={32} color="#16a34a" />
              ) : (
                <AlertTriangle size={32} color="#e11d48" />
              )}
              <div>
                <h3 style={{ margin: 0, color: scanResult.modifiedCount === 0 ? '#15803d' : '#be123c' }}>
                  {scanResult.modifiedCount === 0 && scanResult.missingCount === 0
                    ? 'All Platform Assets 100% Cryptographically Verified'
                    : 'Integrity Discrepancies Detected!'}
                </h3>
                <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: '3px' }}>
                  Scanned <strong>{scanResult.total}</strong> stored files: <strong>{scanResult.verifiedCount}</strong> verified,{' '}
                  <strong>{scanResult.modifiedCount}</strong> altered, <strong>{scanResult.missingCount}</strong> missing.
                </div>
              </div>
            </div>
            <button className="btn btn-secondary btn-small" onClick={() => setScanResult(null)}>
              Dismiss Report
            </button>
          </div>
        </div>
      )}

      {/* Moderator Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap stat-icon-moderator">
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value">{loading ? '—' : items.length}</div>
            <div className="stat-label">Total Platform Files</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap stat-icon-blue">
            <Users size={24} />
          </div>
          <div>
            <div className="stat-value">
              {loading ? '—' : new Set(items.map((i) => i.owner_id)).size}
            </div>
            <div className="stat-label">Active Creators</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap stat-icon-buyer">
            <Lock size={24} />
          </div>
          <div>
            <div className="stat-value">
              {loading ? '—' : items.reduce((acc, i) => acc + Number(i.active_rights_count || 0), 0)}
            </div>
            <div className="stat-label">Active Granted Licenses</div>
          </div>
        </div>
      </div>

      {/* Global Registry Table */}
      <div className="panel">
        <div className="panel-header">
          <h2>Global Content Registry</h2>
          <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
            {filtered.length} {filtered.length === 1 ? 'file' : 'files'} found
          </span>
        </div>

        <div className="filter-bar">
          <div className="search-input-wrap">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              className="input input-with-icon"
              placeholder="Search by file title, original filename, creator name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading platform content records...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No assets found</h3>
            <p className="empty-state-desc">No content matches your search query.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Title & Filename</th>
                  <th>Creator / Owner</th>
                  <th>Size</th>
                  <th>Active Licenses</th>
                  <th>SHA-256 Digest</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.content_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.original_filename}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.owner_name}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{item.owner_email}</div>
                    </td>
                    <td>{formatBytes(item.file_size)}</td>
                    <td>
                      <span className="badge badge-active">
                        {item.active_rights_count || 0} active
                      </span>
                    </td>
                    <td>
                      <button
                        className="hash-chip"
                        onClick={() => handleCopy(item.file_hash)}
                        title={`Click to copy full hash: ${item.file_hash}`}
                      >
                        {copiedHash === item.file_hash ? 'Copied!' : `${item.file_hash.slice(0, 10)}…`}
                      </button>
                    </td>
                    <td>{new Date(item.upload_timestamp).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/content/${item.content_id}`} className="btn btn-small btn-secondary">
                        <ExternalLink size={14} /> Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
