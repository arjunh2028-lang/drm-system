import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  ShoppingBag,
  Search,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  Eye,
  Download,
  ExternalLink,
} from 'lucide-react';
import { getAccessibleContent, getErrorMessage } from '../services/api';

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

export default function AccessibleContent() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccessibleContent()
      .then((res) => setItems(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            <KeyRound size={16} /> Digital License Library
          </div>
          <h1>My Licensed Content</h1>
          <p className="page-subtitle">DRM-protected assets licensed to you by content owners or purchased in the marketplace.</p>
        </div>

        <Link to="/marketplace" className="btn btn-buyer">
          <ShoppingBag size={16} /> Browse Marketplace
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
              placeholder="Search licensed content by title, filename, or owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading your licensed assets...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <KeyRound size={32} />
            </div>
            <h3 className="empty-state-title">No licensed files found</h3>
            <p className="empty-state-desc">
              {search
                ? 'No content matches your search filter.'
                : 'You have not acquired or been granted rights to any files yet.'}
            </p>
            {!search && (
              <Link to="/marketplace" className="btn btn-buyer">
                <ShoppingBag size={16} /> Explore DRM Marketplace
              </Link>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Content Title</th>
                  <th>Owner / Creator</th>
                  <th>File Size</th>
                  <th>Your Active Rights</th>
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
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.original_filename}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{item.owner_name}</td>
                    <td>{formatBytes(item.file_size)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {item.my_rights.map((r) => (
                          <span key={r} className={`badge badge-${r.toLowerCase()}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Link to={`/content/${item.content_id}`} className="btn btn-small btn-secondary">
                        <ExternalLink size={14} /> Open & Access
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
