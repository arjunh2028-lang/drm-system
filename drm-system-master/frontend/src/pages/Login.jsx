import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <span className="brand-mark">DRM</span>
        </div>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to manage your content and rights.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field-label">Email</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        <label className="field-label">Password</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log In'}
        </button>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>

        <div className="auth-hint">
          Demo accounts: <code>alice@example.com</code>, <code>bob@example.com</code>,{' '}
          <code>carol@example.com</code> — password <code>Password123!</code>
        </div>
      </form>
    </div>
  );
}
