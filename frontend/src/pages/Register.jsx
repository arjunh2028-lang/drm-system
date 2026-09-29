import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { Palette, ShoppingBag, ShieldAlert, User, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AntigravityCanvas from '../components/AntigravityCanvas';
import { useCardTilt } from '../hooks/useCardTilt';
import ThemeToggle from '../components/ThemeToggle';
import Loader from '../components/Loader';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cardRef = useRef(null);
  useCardTilt(cardRef);

  const [role, setRole] = useState('CONSUMER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get('role');
    if (roleParam === 'creator') setRole('CREATOR');
    else if (roleParam === 'buyer' || roleParam === 'user') setRole('CONSUMER');
    else if (roleParam === 'moderator') setRole('MODERATOR');
  }, [location.search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password, confirmPassword, role);
      setSubmitting(false);
      setAccountCreated(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  const roleMeta = {
    CREATOR: {
      label: 'Content Creator',
      themeClass: 'btn-creator',
      color: '#4f46e5',
      bg: '#eef2ff',
      icon: Palette,
      desc: 'Upload, encrypt, license and manage digital rights for your files.',
      loginPath: '/login/creator',
    },
    CONSUMER: {
      label: 'Buyer / User',
      themeClass: 'btn-buyer',
      color: '#059669',
      bg: '#ecfdf5',
      icon: ShoppingBag,
      desc: 'Explore the marketplace, acquire digital licenses, and stream/download files.',
      loginPath: '/login/buyer',
    },
    MODERATOR: {
      label: 'System Moderator',
      themeClass: 'btn-moderator',
      color: '#d97706',
      bg: '#fef3c7',
      icon: ShieldAlert,
      desc: 'Audit system-wide files, manage security compliance, and run batch integrity tests.',
      loginPath: '/login/moderator',
    },
  };

  const activeMeta = roleMeta[role] || roleMeta.CONSUMER;
  const ActiveIcon = activeMeta.icon;

  const roleClassKey = role === 'CREATOR' ? 'creator' : role === 'MODERATOR' ? 'moderator' : 'buyer';

  return (
    <div className={`auth-page auth-page-${roleClassKey}`}>
      {submitting && (
        <Loader
          fullScreen={true}
          message={`Provisioning ${activeMeta.label} credentials & cryptographic identity...`}
        />
      )}

      {accountCreated && (
        <div className="drm-loader-fullscreen-backdrop">
          <div className="drm-loader-wrapper" style={{ animation: 'fadeIn 0.35s ease', textAlign: 'center', maxWidth: '440px', padding: '0 20px' }}>
            <div className="loader-badge" style={{ fontSize: '1.05rem', padding: '10px 24px' }}>
              <CheckCircle2 size={20} />
              <span>Account Created</span>
            </div>
            <div className="loader-subtext" style={{ fontSize: '1.2rem', color: 'var(--color-text, #f8fafc)', fontWeight: 600, marginTop: '8px' }}>
              Account created successfully!
            </div>
            <p style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.94rem', margin: '6px 0 24px', lineHeight: 1.5 }}>
              Your {activeMeta.label} account has been registered. You can now sign in to access your dashboard.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link
                to={activeMeta.loginPath}
                className={`btn ${activeMeta.themeClass}`}
                style={{ padding: '12px 36px', fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Sign In <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      <ThemeToggle variant="floating" />
      <AntigravityCanvas theme={roleClassKey} />
      <div
        ref={cardRef}
        className={`role-auth-card role-auth-card-${roleClassKey}`}
        style={{
          maxWidth: '480px',
          ...(submitting || accountCreated
            ? { opacity: 0, pointerEvents: 'none', transform: 'scale(0.96)', transition: 'all 0.25s ease' }
            : { transition: 'all 0.25s ease' }),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div className="role-auth-banner" style={{ background: activeMeta.bg, color: activeMeta.color }}>
            <ActiveIcon size={15} />
            {activeMeta.label} Registration
          </div>
          <Link to="/login" style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={14} /> Back to Portals
          </Link>
        </div>

        <h1 style={{ fontSize: '1.65rem' }}>Create Your Account</h1>
        <p className="page-subtitle" style={{ marginBottom: '18px' }}>
          {activeMeta.desc}
        </p>

        {/* Role Selector Tabs */}
        <label className="field-label" style={{ marginTop: '0' }}>Select Account Role</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setRole('CREATOR')}
            className="btn"
            style={{
              padding: '8px 4px',
              fontSize: '0.78rem',
              flexDirection: 'column',
              gap: '4px',
              border: role === 'CREATOR' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
              background: role === 'CREATOR' ? '#eef2ff' : '#ffffff',
              color: role === 'CREATOR' ? '#4f46e5' : '#475569',
            }}
          >
            <Palette size={18} />
            <span>Creator</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('CONSUMER')}
            className="btn"
            style={{
              padding: '8px 4px',
              fontSize: '0.78rem',
              flexDirection: 'column',
              gap: '4px',
              border: role === 'CONSUMER' ? '2px solid #059669' : '1px solid #cbd5e1',
              background: role === 'CONSUMER' ? '#ecfdf5' : '#ffffff',
              color: role === 'CONSUMER' ? '#059669' : '#475569',
            }}
          >
            <ShoppingBag size={18} />
            <span>Buyer</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('MODERATOR')}
            className="btn"
            style={{
              padding: '8px 4px',
              fontSize: '0.78rem',
              flexDirection: 'column',
              gap: '4px',
              border: role === 'MODERATOR' ? '2px solid #d97706' : '1px solid #cbd5e1',
              background: role === 'MODERATOR' ? '#fef3c7' : '#ffffff',
              color: role === 'MODERATOR' ? '#d97706' : '#475569',
            }}
          >
            <ShieldAlert size={18} />
            <span>Moderator</span>
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="field-label">Full Name</label>
          <div className="input-wrap">
            <User size={18} className="input-icon" />
            <input
              className="input input-with-icon"
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <label className="field-label">Email Address</label>
          <div className="input-wrap">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              className="input input-with-icon"
              placeholder="alex@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label className="field-label">Password (Min. 8 characters)</label>
          <div className="input-wrap">
            <Lock size={18} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              className="input input-with-icon"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label className="field-label">Confirm Password</label>
          <div className="input-wrap">
            <Lock size={18} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              className="input input-with-icon"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            className={`btn ${activeMeta.themeClass} btn-block`}
            type="submit"
            disabled={submitting}
            style={{ marginTop: '22px' }}
          >
            {submitting ? 'Registering...' : `Create ${activeMeta.label} Account`} <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-switch-portal" style={{ marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to={activeMeta.loginPath} style={{ fontWeight: 600, color: activeMeta.color }}>
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
}
