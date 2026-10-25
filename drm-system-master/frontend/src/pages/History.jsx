import React, { useEffect, useState } from 'react';
import { getHistory, listAllUsers, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  History as HistoryIcon,
  Search,
  ShieldAlert,
  CheckCircle2,
  UploadCloud,
  User,
  FolderLock,
  Globe,
  Filter,
} from 'lucide-react';

export default function History() {
  const { user } = useAuth();
  const role = user?.role || 'CREATOR';

  const defaultScope = role === 'MODERATOR' ? 'all' : 'user';
  const [scope, setScope] = useState(defaultScope);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load user list for moderator filter
  useEffect(() => {
    if (role === 'MODERATOR') {
      listAllUsers()
        .then((res) => setAllUsers(res.data))
        .catch(() => {});
    }
  }, [role]);

  // Fetch history when scope or selected user changes
  useEffect(() => {
    setLoading(true);
    setError('');
    getHistory({
      limit: 200,
      scope,
      userId: selectedUserId || undefined,
    })
      .then((res) => setItems(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [scope, selectedUserId]);

  function getActionBadge(action) {
    if (action.includes('UPLOAD')) {
      return (
        <span className="badge badge-view">
          <UploadCloud size={12} /> {action.replace(/_/g, ' ')}
        </span>
      );
    }
    if (action.includes('GRANT') || action.includes('ACQUIRED')) {
      return (
        <span className="badge badge-active">
          <CheckCircle2 size={12} /> {action.replace(/_/g, ' ')}
        </span>
      );
    }
    if (action.includes('REVOKE')) {
      return (
        <span className="badge badge-revoked">
          <ShieldAlert size={12} /> {action.replace(/_/g, ' ')}
        </span>
      );
    }
    if (action.includes('DOWNLOAD')) {
      return <span className="badge badge-download">{action.replace(/_/g, ' ')}</span>;
    }
    return <span className="badge badge-neutral">{action.replace(/_/g, ' ')}</span>;
  }

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (
      (item.action && item.action.toLowerCase().includes(q)) ||
      (item.content_title && item.content_title.toLowerCase().includes(q)) ||
      (item.actor_name && item.actor_name.toLowerCase().includes(q)) ||
      (item.target_user_name && item.target_user_name.toLowerCase().includes(q)) ||
      (item.details && item.details.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--color-primary)',
              fontSize: '0.84rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '4px',
            }}
          >
            <HistoryIcon size={16} /> Access & Compliance Ledger
          </div>
          <h1>
            {role === 'MODERATOR'
              ? 'Platform Audit & Access History'
              : 'My Access & Activity History'}
          </h1>
          <p className="page-subtitle">
            {role === 'CONSUMER' &&
              `User-specific audit trail of all content access, downloads, views, and license events for ${user?.name || 'your account'}.`}
            {role === 'CREATOR' &&
              (scope === 'user'
                ? `Personal activity and access logs initiated by or targeted to ${user?.name || 'your account'}.`
                : 'Access telemetry and license events on files you uploaded.')}
            {role === 'MODERATOR' &&
              'System-wide audit trail with user-specific filtering and compliance verification.'}
          </p>
        </div>

        {/* User identification chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary-border)',
              color: 'var(--color-primary)',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <User size={14} />
            <span>Active: {user?.name} ({role})</span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel">
        {/* Scope Switcher Controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {/* Creator Scope Tabs */}
          {role === 'CREATOR' && (
            <div className="history-scope-tabs">
              <button
                type="button"
                className={`history-tab-btn ${scope === 'user' ? 'active' : ''}`}
                onClick={() => setScope('user')}
              >
                <User size={14} /> My Access Logs
              </button>
              <button
                type="button"
                className={`history-tab-btn ${scope === 'content' ? 'active' : ''}`}
                onClick={() => setScope('content')}
              >
                <FolderLock size={14} /> Access on My Files
              </button>
            </div>
          )}

          {/* Moderator Controls */}
          {role === 'MODERATOR' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="history-scope-tabs">
                <button
                  type="button"
                  className={`history-tab-btn ${scope === 'all' && !selectedUserId ? 'active' : ''}`}
                  onClick={() => {
                    setScope('all');
                    setSelectedUserId('');
                  }}
                >
                  <Globe size={14} /> All System Logs
                </button>
                <button
                  type="button"
                  className={`history-tab-btn ${scope === 'user' && !selectedUserId ? 'active' : ''}`}
                  onClick={() => {
                    setScope('user');
                    setSelectedUserId('');
                  }}
                >
                  <User size={14} /> My Personal Actions
                </button>
              </div>

              {/* User filter for Moderator */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} color="#94a3b8" />
                <select
                  className="select"
                  style={{ width: 'auto', minWidth: '200px', padding: '6px 10px', fontSize: '0.84rem' }}
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    if (e.target.value) setScope('user');
                  }}
                >
                  <option value="">-- Filter by Specific User --</option>
                  {allUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.name} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
                {selectedUserId && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => {
                      setSelectedUserId('');
                      setScope('all');
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Buyer Scope Indicator */}
          {role === 'CONSUMER' && (
            <div style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 500 }}>
              Viewing strictly your personal access & transaction logs
            </div>
          )}
        </div>

        <div className="filter-bar">
          <div className="search-input-wrap">
            <Search size={18} className="input-icon" />
            <input
              type="text"
              className="input input-with-icon"
              placeholder="Filter audit events by action, content title, actor, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading activity audit records...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No audit records found</h3>
            <p className="empty-state-desc">
              {role === 'CONSUMER'
                ? 'You have not accessed, viewed, or acquired any files yet.'
                : 'No activity matches your current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Audit Action</th>
                  <th>Target Content</th>
                  <th>Actor (Initiator)</th>
                  <th>Target User</th>
                  <th>Details & Context</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const isActorMe = a.actor_id === user?.user_id;
                  const isTargetMe = a.target_user_id === user?.user_id;
                  return (
                    <tr key={a.activity_id}>
                      <td>{getActionBadge(a.action)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        {a.content_title || '—'}
                      </td>
                      <td>
                        {isActorMe ? (
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                            You ({a.actor_name})
                          </span>
                        ) : (
                          <span>{a.actor_name || 'System'}</span>
                        )}
                      </td>
                      <td>
                        {isTargetMe ? (
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                            You ({a.target_user_name})
                          </span>
                        ) : (
                          <span>{a.target_user_name || '—'}</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>
                        {a.details || '—'}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
