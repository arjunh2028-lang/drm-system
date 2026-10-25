const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { UPLOAD_DIR } = require('../config/paths');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Only allow a conservative set of extensions for a college prototype.
// This is a basic content-type/extension allowlist, not a full
// antivirus scan -- adequate for a V1 DRM demo.
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.zip', '.png', '.jpg', '.jpeg', '.gif', '.mp3', '.mp4',
]);

function sanitizeBaseName(originalName) {
  const base = path.basename(originalName, path.extname(originalName));
  // Strip anything that isn't alphanumeric, dash, underscore or space,
  // so the stored filename can never be used for path traversal.
  return base.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().slice(0, 60) || 'file';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const safeBase = sanitizeBaseName(file.originalname);
    cb(null, `${unique}-${safeBase}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type "${ext || 'unknown'}" is not allowed.`));
  }
  cb(null, true);
}

const maxSizeBytes = (Number(process.env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeBytes },
});

module.exports = { upload, UPLOAD_DIR };
