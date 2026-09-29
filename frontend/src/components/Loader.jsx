import React from 'react';
import './Loader.css';
import { CheckCircle2 } from 'lucide-react';

export default function Loader({
  text = 'loading',
  words = ['licenses', 'keys', 'assets', 'security', 'licenses'],
  fullScreen = false,
  badge = null,
  message = 'Securing session & establishing cryptographic tunnel...',
}) {
  const content = (
    <div className="drm-loader-wrapper">
      {badge && (
        <div className="loader-badge">
          <CheckCircle2 size={16} />
          <span>{badge}</span>
        </div>
      )}
      <div className="card">
        <div className="loader">
          <p>{text}</p>
          <div className="words">
            {words.map((word, index) => (
              <span key={index} className="word">
                {word}
              </span>
            ))}
          </div>
        </div>
      </div>
      {message && <div className="loader-subtext">{message}</div>}
    </div>
  );

  if (fullScreen) {
    return <div className="drm-loader-fullscreen-backdrop">{content}</div>;
  }

  return content;
}
