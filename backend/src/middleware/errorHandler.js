module.exports = function errorHandler(err, req, res, next) {
  console.error(err);
  const status = Number(err.statusCode || err.status) || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : err.message
  });
};
