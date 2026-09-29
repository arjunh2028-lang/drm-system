const path = require('path');
require('dotenv').config();

// Anchor every path to the backend package root (this file's location
// is fixed at backend/src/config/paths.js, so this is reliable
// regardless of the current working directory the process was
// started from).
const BACKEND_ROOT = path.resolve(__dirname, '../../');       // .../backend
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '../');         // .../drm-system

// UPLOAD_DIR in .env is documented as relative to backend/ (e.g. "../uploads").
// An absolute path in .env also works, since path.resolve ignores the
// base when the second argument is already absolute.
const UPLOAD_DIR = path.resolve(BACKEND_ROOT, process.env.UPLOAD_DIR || '../uploads');

module.exports = { BACKEND_ROOT, PROJECT_ROOT, UPLOAD_DIR };
