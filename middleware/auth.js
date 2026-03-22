const jwt = require('jsonwebtoken');
const User = require('../models/User'); // ✅ Import User model

module.exports = async function (req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Fetch full user from DB
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    req.user = user; // ✅ Attach full user object (with email, name, etc.)
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};
