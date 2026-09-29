import React from 'react';
import { Link } from 'react-router-dom';
import {
  Palette,
  ShoppingBag,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Lock,
  FileCheck2,
  Users,
  Eye,
  Activity,
} from 'lucide-react';
import AntigravityCanvas from '../components/AntigravityCanvas';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPortalHub() {
  return (
    <div className="auth-page">
      <ThemeToggle variant="floating" />
      <AntigravityCanvas theme="hub" />
      <div className="portal-hub-container">
        <div className="portal-hub-header">
          <div className="portal-hub-badge">
            <ShieldCheck size={16} />
            Enterprise DRM Rights Management
          </div>
          <h1 className="portal-hub-title">Select Your DRM Access Portal</h1>
          <p className="portal-hub-subtitle">
            Choose your designated portal to sign in or create an account. Each portal is tailored with specialized capabilities for your workflow.
          </p>
        </div>

        <div className="portal-cards-grid">
          {/* Creator Portal Card */}
          <div className="portal-card portal-card-creator">
            <div className="portal-icon-wrap portal-icon-creator">
              <Palette size={28} />
            </div>
            <h2 className="portal-role-name">Content Creator</h2>
            <p className="portal-desc">
              For content owners, authors, researchers, and creators looking to protect, encrypt, and monetize digital assets.
            </p>
            <ul className="portal-features">
              <li>
                <Lock size={15} /> Encrypt & upload digital files
              </li>
              <li>
                <FileCheck2 size={15} /> Automated SHA-256 integrity seal
              </li>
              <li>
                <Users size={15} /> Grant & revoke viewer / buyer licenses
              </li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link to="/login/creator" className="btn btn-creator btn-block">
                Creator Sign In <ArrowRight size={16} />
              </Link>
              <Link
                to="/register?role=creator"
                className="btn btn-ghost btn-block"
                style={{
                  fontSize: '0.82rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                Create Creator Account
              </Link>
            </div>
          </div>

          {/* Buyer / User Portal Card */}
          <div className="portal-card portal-card-buyer">
            <div className="portal-icon-wrap portal-icon-buyer">
              <ShoppingBag size={28} />
            </div>
            <h2 className="portal-role-name">Buyer / User</h2>
            <p className="portal-desc">
              For end-users, clients, and consumers seeking to discover, purchase, and consume DRM-protected licensed files.
            </p>
            <ul className="portal-features">
              <li>
                <ShoppingBag size={15} /> Explore DRM content catalog
              </li>
              <li>
                <Eye size={15} /> Acquire VIEW & DOWNLOAD rights
              </li>
              <li>
                <Lock size={15} /> Instant secure in-browser decryption
              </li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link to="/login/buyer" className="btn btn-buyer btn-block">
                Buyer Sign In <ArrowRight size={16} />
              </Link>
              <Link
                to="/register?role=buyer"
                className="btn btn-ghost btn-block"
                style={{
                  fontSize: '0.82rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                Create Buyer Account
              </Link>
            </div>
          </div>

          {/* Moderator Portal Card */}
          <div className="portal-card portal-card-moderator">
            <div className="portal-icon-wrap portal-icon-moderator">
              <ShieldAlert size={28} />
            </div>
            <h2 className="portal-role-name">System Moderator</h2>
            <p className="portal-desc">
              For platform administrators and compliance auditors managing system security, global assets, and policy enforcement.
            </p>
            <ul className="portal-features">
              <li>
                <Activity size={15} /> System-wide rights & activity audit
              </li>
              <li>
                <FileCheck2 size={15} /> 1-Click batch integrity scan
              </li>
              <li>
                <ShieldCheck size={15} /> Global license revocation control
              </li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link to="/login/moderator" className="btn btn-moderator btn-block">
                Moderator Sign In <ArrowRight size={16} />
              </Link>
              <Link
                to="/register?role=moderator"
                className="btn btn-ghost btn-block"
                style={{
                  fontSize: '0.82rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                Create Moderator Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
