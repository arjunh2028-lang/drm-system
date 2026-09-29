import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File,
  Lock,
  CheckCircle2,
  Download,
  Eye,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { getCatalogContent, purchaseRight, getErrorMessage } from '../services/api';
import Modal from '../components/Modal';
import Loader from '../components/Loader';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return <FileText size={22} color="#e11d48" />;
  if (['doc', 'docx', 'txt'].includes(ext)) return <FileText size={22} color="#2563eb" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={22} color="#16a34a" />;
  if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return <FileArchive size={22} color="#ca8a04" />;
  if (['js', 'jsx', 'ts', 'py', 'html', 'json'].includes(ext)) return <FileCode size={22} color="#7c3aed" />;
  return <File size={22} color="#64748b" />;
}

export default function Marketplace() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Purchase modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseType, setPurchaseType] = useState('VIEW');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  function loadCatalog() {
    setLoading(true);
    getCatalogContent()
      .then((res) => setItems(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  async function handlePurchase(e) {
    e.preventDefault();
    if (!selectedItem) return;
    setPurchaseError('');
    setPurchasing(true);
    try {
      const res = await purchaseRight(selectedItem.content_id, purchaseType);
      setMessage(res.data.message || `License for "${selectedItem.title}" acquired successfully!`);
      setSelectedItem(null);
      loadCatalog();
    } catch (err) {
      setPurchaseError(getErrorMessage(err));
    } finally {
      setPurchasing(false);
    }
  }

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.original_filename.toLowerCase().includes(q) ||
      item.owner_name.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            <ShoppingBag size={16} /> DRM Marketplace
          </div>
          <h1>Content Catalog & Licensing</h1>
          <p className="page-subtitle">
            Discover encrypted assets published by creators. Acquire VIEW or DOWNLOAD licenses to access them securely.
          </p>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <div className="search-input-wrap">
          <Search size={18} className="input-icon" />
          <input
            type="text"
            className="input input-with-icon"
            placeholder="Search by title, filename, or creator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
          <Loader message="Loading marketplace catalog & rights specifications..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel empty-state">
          <div className="empty-state-icon">
            <ShoppingBag size={28} />
          </div>
          <h3 className="empty-state-title">No content matches your search</h3>
          <p className="empty-state-desc">Try searching with different keywords or check back later.</p>
        </div>
      ) : (
        <div className="marketplace-grid">
          {filtered.map((item) => {
            const hasRights = item.user_rights && item.user_rights.length > 0;
            return (
              <div key={item.content_id} className="content-card">
                <div className="content-card-top">
                  <div className="content-card-icon">{getFileIcon(item.original_filename)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="content-card-title" title={item.title}>
                      {item.title}
                    </h3>
                    <div className="content-card-author">By {item.owner_name}</div>
                  </div>
                </div>

                <div className="content-card-meta">
                  <div className="meta-item">
                    <span>{formatBytes(item.file_size)}</span>
                  </div>
                  <div className="meta-item">
                    <span>{new Date(item.upload_timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="meta-item" style={{ marginLeft: 'auto' }}>
                    <ShieldCheck size={14} color="#10b981" />
                    <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>SHA-256</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', minHeight: '26px' }}>
                  {item.is_owner ? (
                    <span className="badge badge-neutral">Owner</span>
                  ) : hasRights ? (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {item.user_rights.map((r) => (
                        <span key={r} className={`badge badge-${r.toLowerCase()}`}>
                          Licensed: {r}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No license acquired yet</span>
                  )}
                </div>

                <div className="content-card-actions">
                  {item.is_owner ? (
                    <Link to={`/content/${item.content_id}`} className="btn btn-secondary btn-block">
                      Manage (Owner)
                    </Link>
                  ) : hasRights ? (
                    <Link to={`/content/${item.content_id}`} className="btn btn-buyer btn-block">
                      <Eye size={15} /> Open Content
                    </Link>
                  ) : (
                    <button
                      className="btn btn-buyer btn-block"
                      onClick={() => {
                        setSelectedItem(item);
                        setPurchaseType('VIEW');
                        setPurchaseError('');
                      }}
                    >
                      <ShoppingBag size={15} /> Acquire License
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Purchase / Acquire License Modal */}
      {selectedItem && (
        <Modal title={`Acquire License: ${selectedItem.title}`} onClose={() => setSelectedItem(null)}>
          {purchaseError && <div className="alert alert-error">{purchaseError}</div>}

          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.86rem' }}>
            <div><strong>Original File:</strong> {selectedItem.original_filename}</div>
            <div><strong>Creator:</strong> {selectedItem.owner_name}</div>
            <div><strong>File Size:</strong> {formatBytes(selectedItem.file_size)}</div>
          </div>

          <form onSubmit={handlePurchase}>
            <label className="field-label">Select License Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: purchaseType === 'VIEW' ? '2px solid #059669' : '1px solid #e2e8f0',
                  background: purchaseType === 'VIEW' ? '#ecfdf5' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="purchaseType"
                  value="VIEW"
                  checked={purchaseType === 'VIEW'}
                  onChange={() => setPurchaseType('VIEW')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>VIEW License (Read-Only)</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Permits in-browser decryption and live inspection without file download.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: purchaseType === 'DOWNLOAD' ? '2px solid #059669' : '1px solid #e2e8f0',
                  background: purchaseType === 'DOWNLOAD' ? '#ecfdf5' : '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="purchaseType"
                  value="DOWNLOAD"
                  checked={purchaseType === 'DOWNLOAD'}
                  onChange={() => setPurchaseType('DOWNLOAD')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>DOWNLOAD License (Full Access)</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Allows secure file download and offline storage of the original decrypted file.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedItem(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-buyer" disabled={purchasing}>
                {purchasing ? 'Acquiring...' : 'Confirm & Acquire'} <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
