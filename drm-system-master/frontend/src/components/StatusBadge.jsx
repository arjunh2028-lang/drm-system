import React from 'react';

// variant: 'active' | 'revoked' | 'verified' | 'modified' | 'missing' | 'neutral'
export default function StatusBadge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
