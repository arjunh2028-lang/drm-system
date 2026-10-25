const multer = require('multer');
const path = require('path');

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

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type "${ext || 'unknown'}" is not allowed.`));
  }
  cb(null, true);
}

const maxSizeBytes = (Number(process.env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024;

const upload = multer({
  // Keep the upload transient in memory. The controller writes only the
  // authenticated ciphertext to the private storage directory.
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: maxSizeBytes },
});

module.exports = { upload, UPLOAD_DIR };
