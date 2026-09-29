import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadContent, getErrorMessage } from '../services/api';
import {
  UploadCloud,
  FileCheck,
  ShieldCheck,
  Lock,
  ArrowRight,
  X,
  File,
} from 'lucide-react';

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleFileSelect(selectedFile) {
    if (!selectedFile) return;
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);

    setSubmitting(true);
    setProgress(0);
    try {
      await uploadContent(formData, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded * 100) / evt.total));
      });
      setSuccess('Content encrypted and uploaded successfully!');
      setTimeout(() => navigate('/my-content'), 900);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontSize: '0.84rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            <UploadCloud size={16} /> Asset Registration
          </div>
          <h1>Upload & Protect Content</h1>
          <p className="page-subtitle">
            Upload digital assets to calculate automated SHA-256 cryptographic hashes and claim creator ownership.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 560px) minmax(0, 380px)', gap: '24px', alignItems: 'start' }}>
        <div className="panel">
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <label className="field-label">Content Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Financial Architecture Proposal"
              required
            />

            <label className="field-label">Digital File</label>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />

            {!file ? (
              <div
                className={`dropzone ${isDragging ? 'active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">
                  <UploadCloud size={28} />
                </div>
                <div>
                  <h4 className="dropzone-title">Click to upload or drag & drop</h4>
                  <p className="dropzone-hint">PDF, DOCX, XLSX, ZIP, Source Code up to 25 MB</p>
                </div>
              </div>
            ) : (
              <div className="file-preview-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <File size={22} color="#4f46e5" />
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{file.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for cryptographic hashing
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {submitting && (
              <div style={{ margin: '18px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginBottom: '6px' }}>
                  <span>Uploading & computing SHA-256...</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button
              className="btn btn-creator btn-block"
              type="submit"
              disabled={submitting || !file}
              style={{ marginTop: '20px' }}
            >
              {submitting ? `Processing ${progress}%...` : 'Register & Protect Asset'} <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Security Info Card */}
        <div className="panel" style={{ background: '#f8fafc' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <ShieldCheck size={20} color="#4f46e5" /> DRM Protection Standards
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem', color: '#475569' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Lock size={18} color="#4f46e5" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Immutable Ownership</strong>
                <div>You are recorded as the sole creator and root authority for this asset.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <FileCheck size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Automated SHA-256 Digest</strong>
                <div>A 256-bit cryptographic digest is generated to detect any subsequent tampering.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <UploadCloud size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Granular Rights Control</strong>
                <div>Grant VIEW, DOWNLOAD, or SHARE rights to specific buyers or publish to marketplace.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
