import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderLock,
  UploadCloud,
  ShoppingBag,
  KeyRound,
  History,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import ThemeToggle from './ThemeToggle';
import AntigravityCanvas from './AntigravityCanvas';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return localStorage.getItem('drm_sidebar_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('drm_sidebar_hidden', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const role = user?.role || 'CREATOR';

  const themeMap = {
    CREATOR: 'creator',
    CONSUMER: 'buyer',
    MODERATOR: 'moderator',
  };
  const currentTheme = themeMap[role] || 'hub';

  // Role-customized navigation items
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    // Creator specific items
    ...(role === 'CREATOR' || role === 'MODERATOR'
      ? [
          { to: '/my-content', label: 'My Content', icon: FolderLock },
          { to: '/upload', label: 'Upload Content', icon: UploadCloud },
        ]
      : []),
    // Marketplace for buyers & creators
    { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
    // Accessible files for buyers & all
    { to: '/accessible', label: 'My Licenses', icon: KeyRound },
    // Moderator specific view
    ...(role === 'MODERATOR'
      ? [{ to: '/moderator', label: 'Moderator Control', icon: ShieldAlert }]
      : []),
    { to: '/history', label: 'Audit History', icon: History },
  ];

  const roleClassMap = {
    CREATOR: 'sidebar-link-creator',
    CONSUMER: 'sidebar-link-buyer',
    MODERATOR: 'sidebar-link-moderator',
  };

  const roleBadgeMap = {
    CREATOR: { label: 'Creator', class: 'role-badge-creator' },
    CONSUMER: { label: 'Buyer', class: 'role-badge-consumer' },
    MODERATOR: { label: 'Moderator', class: 'role-badge-moderator' },
  };

  const roleInfo = roleBadgeMap[role] || { label: role, class: 'role-badge-creator' };

  return (
    <div className={`app-shell app-shell-${currentTheme}`}>
      <AntigravityCanvas theme={currentTheme} interactive={false} />

      {/* Floating Toggle Button when Sidebar is Collapsed */}
      {sidebarHidden && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="sidebar-nav-toggle sidebar-collapsed-toggle"
          aria-label={sidebarHidden ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarHidden ? 'Expand sidebar' : 'Collapse sidebar'}
          tabIndex={0}
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Top Bar */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="#6366f1" />
          <span style={{ fontWeight: 700 }}>DRM Guardian</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle variant="compact" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sidebar-nav-toggle"
            aria-label={mobileMenuOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={mobileMenuOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            tabIndex={0}
          >
            {mobileMenuOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>
      </div>

      <aside className={`sidebar ${sidebarHidden ? 'sidebar-hidden' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon-wrap">
            <ShieldCheck size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-title">DRM Guardian</div>
            <div className="brand-sub">Rights & Marketplace</div>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="sidebar-nav-toggle"
            aria-label={sidebarHidden ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarHidden ? 'Expand sidebar' : 'Collapse sidebar'}
            tabIndex={0}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Navigation</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link ${roleClassMap[role] || ''}${isActive ? ' active' : ''}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle variant="sidebar" collapsed={sidebarHidden} />

          <div className="sidebar-user-card">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <span className={`sidebar-user-role ${roleInfo.class}`}>
                {roleInfo.label}
              </span>
            </div>
          </div>

          <button className="btn btn-ghost btn-block btn-small" onClick={handleLogout}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      <main className={`main-content ${sidebarHidden ? 'main-content-expanded' : ''}`}>
        {children}
      </main>
    </div>
  );
}
