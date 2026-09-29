import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyContent, getAccessibleContent, getHistory, getCatalogContent, getErrorMessage } from '../services/api';
import {
  FolderLock,
  KeyRound,
  HardDrive,
  ShoppingBag,
  UploadCloud,
  History,
  ShieldAlert,
  ArrowRight,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileText,
  UserCheck,
  FileCode,
  Palette,
} from 'lucide-react';
import Loader from '../components/Loader';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [owned, setOwned] = useState([]);
  const [accessible, setAccessible] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const role = user?.role || 'CREATOR';

  useEffect(() => {
    Promise.all([
      getMyContent(),
      getAccessibleContent(),
      getHistory({ limit: 6, scope: role === 'MODERATOR' ? 'all' : 'user' }),
      getCatalogContent(),
    ])
      .then(([ownedRes, accessibleRes, historyRes, catalogRes]) => {
        setOwned(ownedRes.data);
        setAccessible(accessibleRes.data);
        setActivity(historyRes.data);
        setCatalog(catalogRes.data);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const totalStorage = owned.reduce((sum, c) => sum + Number(c.file_size || 0), 0);

  function getActionBadge(action) {
    if (action.includes('UPLOAD')) {
      return <span className="badge badge-view"><UploadCloud size={12} /> Upload</span>;
    }
    if (action.includes('GRANT') || action.includes('ACQUIRED')) {
      return <span className="badge badge-active"><CheckCircle2 size={12} /> License</span>;
    }
    if (action.includes('REVOKE')) {
      return <span className="badge badge-revoked"><ShieldAlert size={12} /> Revoke</span>;
    }
    if (action.includes('DOWNLOAD')) {
      return <span className="badge badge-download">Download</span>;
    }
    return <span className="badge badge-neutral">{action.replace(/_/g, ' ')}</span>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {role === 'CREATOR' && (
              <div className="role-auth-banner role-badge-creator-banner">
                <Palette size={14} /> Creator Studio
              </div>
            )}
            {role === 'CONSUMER' && (
              <div className="role-auth-banner role-badge-buyer-banner">
                <ShoppingBag size={14} /> Buyer Portal
              </div>
            )}
            {role === 'MODERATOR' && (
              <div className="role-auth-banner role-badge-moderator-banner">
                <ShieldAlert size={14} /> Moderator Control
              </div>
            )}
          </div>
          <h1>Welcome, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">
            {role === 'CREATOR' && 'Manage your encrypted assets, access permissions, and distribution.'}
            {role === 'CONSUMER' && 'Browse licensed assets, view files, and discover new protected content.'}
            {role === 'MODERATOR' && 'System-wide governance, global asset registry, and integrity monitoring.'}
          </p>
        </div>

        <div className="header-actions">
          {role === 'CREATOR' && (
            <Link to="/upload" className="btn btn-creator">
              <UploadCloud size={16} /> Upload New File
            </Link>
          )}
          {role === 'CONSUMER' && (
            <Link to="/marketplace" className="btn btn-buyer">
              <ShoppingBag size={16} /> Explore Marketplace
            </Link>
          )}
          {role === 'MODERATOR' && (
            <Link to="/moderator" className="btn btn-moderator">
              <ShieldAlert size={16} /> Moderator Control
            </Link>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* KPI Metric Cards */}
      <div className="stat-grid">
        {role === 'CREATOR' && (
          <>
            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-creator">
                <FolderLock size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : owned.length}</div>
                <div className="stat-label">Files You Own</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-buyer">
                <KeyRound size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : accessible.length}</div>
                <div className="stat-label">Accessible Files</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-blue">
                <HardDrive size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : formatBytes(totalStorage)}</div>
                <div className="stat-label">Protected Storage</div>
              </div>
            </div>
          </>
        )}

        {role === 'CONSUMER' && (
          <>
            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-buyer">
                <KeyRound size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : accessible.length}</div>
                <div className="stat-label">Licensed Content</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-creator">
                <ShoppingBag size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : catalog.length}</div>
                <div className="stat-label">Marketplace Files</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-blue">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="stat-value">Active</div>
                <div className="stat-label">License Status</div>
              </div>
            </div>
          </>
        )}

        {role === 'MODERATOR' && (
          <>
            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-moderator">
                <FileText size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : catalog.length}</div>
                <div className="stat-label">Total Platform Files</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-creator">
                <FolderLock size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : owned.length}</div>
                <div className="stat-label">Files Owned by You</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrap stat-icon-buyer">
                <UserCheck size={24} />
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : accessible.length}</div>
                <div className="stat-label">Active Licenses</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Action Cards Grid */}
      <div className="panel" style={{ padding: '20px 24px' }}>
        <h3 style={{ marginBottom: '14px' }}>Quick Navigation</h3>
        <div className="action-card-grid">
          {(role === 'CREATOR' || role === 'MODERATOR') && (
            <Link to="/upload" className="action-card">
              <UploadCloud size={20} color="#4f46e5" />
              <div className="action-card-title">
                Upload New Asset <ArrowRight size={14} />
              </div>
              <div className="action-card-desc">Encrypt and register new files on the ledger.</div>
            </Link>
          )}

          <Link to="/marketplace" className="action-card">
            <ShoppingBag size={20} color="#059669" />
            <div className="action-card-title">
              DRM Marketplace <ArrowRight size={14} />
            </div>
            <div className="action-card-desc">Browse published assets and acquire licenses.</div>
          </Link>

          {(role === 'CREATOR' || role === 'MODERATOR') && (
            <Link to="/my-content" className="action-card">
              <FolderLock size={20} color="#4f46e5" />
              <div className="action-card-title">
                My Content Files <ArrowRight size={14} />
              </div>
              <div className="action-card-desc">Inspect your uploaded assets and grant rights.</div>
            </Link>
          )}

          <Link to="/accessible" className="action-card">
            <KeyRound size={20} color="#0284c7" />
            <div className="action-card-title">
              My Licensed Content <ArrowRight size={14} />
            </div>
            <div className="action-card-desc">View or download content shared with you.</div>
          </Link>

          {role === 'MODERATOR' && (
            <Link to="/moderator" className="action-card">
              <ShieldAlert size={20} color="#e11d48" />
              <div className="action-card-title">
                System Governance <ArrowRight size={14} />
              </div>
              <div className="action-card-desc">Global content registry & batch integrity scan.</div>
            </Link>
          )}
        </div>
      </div>

      {/* Recent Activity Panel */}
      <div className="panel">
        <div className="panel-header">
          <h2>{role === 'MODERATOR' ? 'Recent Platform Audit Log' : 'My Recent Access Log'}</h2>
          <Link to="/history" style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View full log <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '36px 0', display: 'flex', justifyContent: 'center' }}>
            <Loader message="Fetching telemetry & rights events..." />
          </div>
        ) : activity.length === 0 ? (
          <p className="muted">No recent activity recorded.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Target Content</th>
                  <th>Actor</th>
                  <th>Details</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.activity_id}>
                    <td>{getActionBadge(a.action)}</td>
                    <td style={{ fontWeight: 600 }}>{a.content_title || '—'}</td>
                    <td>{a.actor_name || 'System'}</td>
                    <td style={{ color: '#64748b' }}>{a.details || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {new Date(a.created_at).toLocaleString()}
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
