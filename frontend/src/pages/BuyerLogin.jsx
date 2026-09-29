import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { ShoppingBag, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import AntigravityCanvas from '../components/AntigravityCanvas';
import { useCardTilt } from '../hooks/useCardTilt';
import ThemeToggle from '../components/ThemeToggle';
import Loader from '../components/Loader';

export default function BuyerLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef(null);
  useCardTilt(cardRef);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password, 'CONSUMER');
      setTransitioning(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1900);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page auth-page-buyer">
      {transitioning && (
        <Loader
          fullScreen={true}
          message="Loading Buyer Dashboard & verifying asset licenses..."
        />
      )}
      <ThemeToggle variant="floating" />
      <AntigravityCanvas theme="buyer" />
      <div
        ref={cardRef}
        className="role-auth-card role-auth-card-buyer"
        style={transitioning ? { opacity: 0, pointerEvents: 'none', transform: 'scale(0.96)', transition: 'all 0.25s ease' } : { transition: 'all 0.25s ease' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div className="role-auth-banner" style={{ background: '#ecfdf5', color: '#059669' }}>
            <ShoppingBag size={15} />
            Buyer / User Portal
          </div>
          <Link to="/login" style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={14} /> All Portals
          </Link>
        </div>

        <h1 style={{ fontSize: '1.65rem' }}>Buyer Sign In</h1>
        <p className="page-subtitle" style={{ marginBottom: '22px' }}>
          Explore the DRM content catalog, access purchased digital licenses, and securely stream or download files.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="field-label">Email Address</label>
          <div className="input-wrap">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              className="input input-with-icon"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <label className="field-label">Password</label>
          <div className="input-wrap">
            <Lock size={18} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              className="input input-with-icon"
              placeholder="Enter your password"
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

          <button
            className="btn btn-buyer btn-block"
            type="submit"
            disabled={submitting}
            style={{ marginTop: '22px' }}
          >
            {submitting ? 'Authenticating...' : 'Sign In as Buyer'} <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-switch-portal" style={{ marginTop: '20px' }}>
          Don&apos;t have a buyer account?{' '}
          <Link to="/register?role=buyer" style={{ fontWeight: 600, color: '#059669' }}>
            Register as Buyer
          </Link>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '16px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.8rem', color: '#64748b' }}>
          <span>Switch portal:</span>
          <Link to="/login/creator" style={{ color: '#4f46e5', fontWeight: 600 }}>Creator Portal</Link>
          <span>•</span>
          <Link to="/login/moderator" style={{ color: '#d97706', fontWeight: 600 }}>Moderator Portal</Link>
        </div>
      </div>
    </div>
  );
}
