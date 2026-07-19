const multer = require('multer');

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
    return res.status(400).json({ error: message });
  }

  // Body parser JSON syntax errors.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // PostgreSQL unique violation.
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { ApiError, notFound, errorHandler };
