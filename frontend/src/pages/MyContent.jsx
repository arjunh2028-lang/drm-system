import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderLock,
  UploadCloud,
  Search,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { getMyContent, getErrorMessage } from '../services/api';
import Loader from '../components/Loader';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return <FileText size={20} color="#e11d48" />;
  if (['doc', 'docx', 'txt'].includes(ext)) return <FileText size={20} color="#2563eb" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={20} color="#16a34a" />;
  if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return <FileArchive size={20} color="#ca8a04" />;
  if (['js', 'jsx', 'ts', 'py', 'html', 'json'].includes(ext)) return <FileCode size={20} color="#7c3aed" />;
  return <File size={20} color="#64748b" />;
}

export default function MyContent() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState('');

  useEffect(() => {
    getMyContent()
      .then((res) => setItems(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function handleCopy(hash) {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(''), 2000);
  }

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.original_filename.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            <FolderLock size={16} /> Content Portfolio
          </div>
          <h1>My Content</h1>
          <p className="page-subtitle">Encrypted files you own, manage digital licenses for, and monitor.</p>
        </div>
        <Link to="/upload" className="btn btn-creator">
          <UploadCloud size={16} /> Upload New File
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              className="input input-with-icon"
              placeholder="Filter by title or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
            <Loader message="Loading encrypted content files & rights logs..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FolderLock size={32} />
            </div>
            <h3 className="empty-state-title">No content found</h3>
            <p className="empty-state-desc">
              {search ? 'No files match your query.' : 'You haven’t uploaded any digital assets yet.'}
            </p>
            {!search && (
              <Link to="/upload" className="btn btn-creator">
                <UploadCloud size={16} /> Upload Your First File
              </Link>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>File Details</th>
                  <th>Original Filename</th>
                  <th>Size</th>
                  <th>Uploaded Date</th>
                  <th>SHA-256 Digest</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.content_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {getFileIcon(item.original_filename)}
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.title}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#475569', fontSize: '0.84rem' }}>{item.original_filename}</td>
                    <td>{formatBytes(item.file_size)}</td>
                    <td style={{ color: '#64748b' }}>{new Date(item.upload_timestamp).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="hash-chip"
                        onClick={() => handleCopy(item.file_hash)}
                        title={`Click to copy: ${item.file_hash}`}
                      >
                        {copiedHash === item.file_hash ? (
                          <>
                            <Check size={13} color="#16a34a" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={13} /> {item.file_hash.slice(0, 10)}…
                          </>
                        )}
                      </button>
                    </td>
                    <td>
                      <Link to={`/content/${item.content_id}`} className="btn btn-small btn-secondary">
                        <ExternalLink size={14} /> Manage Rights
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
