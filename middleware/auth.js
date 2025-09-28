const jwt = require('jsonwebtoken');

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { user: { id: user.id } },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { user: { id: user.id } },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

module.exports = function(req, res, next) {
  // Get tokens from header
  const accessToken = req.header('x-auth-token');
  const refreshToken = req.header('x-refresh-token');

  // Check if no tokens
  if (!accessToken && !refreshToken) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify access token
  const decoded = verifyToken(accessToken, process.env.JWT_SECRET);
  if (decoded) {
    req.user = decoded.user;
    return next();
  }

  // If access token is invalid, try refresh token
  if (refreshToken) {
    const refreshDecoded = verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    if (!refreshDecoded) {
      return res.status(401).json({ message: 'Session expired, please login again' });
    }

    // Generate new tokens
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(refreshDecoded.user);

    // Set new tokens in response headers
    res.setHeader('x-auth-token', newAccessToken);
    res.setHeader('x-refresh-token', newRefreshToken);

    req.user = refreshDecoded.user;
    return next();
  }

  return res.status(401).json({ message: 'Token is not valid' });
};

module.exports.generateTokens = generateTokens;