// server/middleware/errorHandler.js

function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Duplicate entry – record already exists' });
  }

  const status  = err.statusCode || err.status || 500;
  const message = err.message    || 'Internal server error';

  res.status(status).json({ success: false, message });
}

module.exports = errorHandler;
