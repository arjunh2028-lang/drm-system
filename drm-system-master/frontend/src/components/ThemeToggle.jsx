import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({
  variant = 'compact',
  collapsed = false,
  className = '',
  style,
}) {
  const { isDark, toggleTheme } = useTheme();

  // Floating variant for Login / Hub pages
  if (variant === 'floating') {
    return (
      <div className="theme-toggle-floating-wrap">
        <button
          type="button"
          onClick={toggleTheme}
          className={`theme-toggle-compact-btn ${className}`}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={style}
        >
          {isDark ? (
            <Sun size={18} className="theme-toggle-icon theme-toggle-icon-sun" />
          ) : (
            <Moon size={18} className="theme-toggle-icon theme-toggle-icon-moon" />
          )}
        </button>
      </div>
    );
  }

  // Sidebar theme component: Entire outer container is a clickable button
  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`sidebar-theme-btn ${collapsed ? 'sidebar-theme-btn-collapsed' : ''} ${className}`}
        aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        style={style}
      >
        {!collapsed && (
          <span className="sidebar-theme-label">
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
        )}
        <span className="sidebar-theme-icon-wrap">
          {isDark ? (
            <Moon size={18} className="theme-toggle-icon theme-toggle-icon-moon" />
          ) : (
            <Sun size={18} className="theme-toggle-icon theme-toggle-icon-sun" />
          )}
        </span>
      </button>
    );
  }

  // Compact variant (e.g. mobile top bar)
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-compact-btn ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={style}
    >
      {isDark ? (
        <Sun size={18} className="theme-toggle-icon theme-toggle-icon-sun" />
      ) : (
        <Moon size={18} className="theme-toggle-icon theme-toggle-icon-moon" />
      )}
    </button>
  );
}
