const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { userId: user.user_id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, role } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    throw new ApiError(400, 'Name, email, password and confirmPassword are all required.');
  }
  if (name.trim().length < 2) {
    throw new ApiError(400, 'Name must be at least 2 characters.');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new ApiError(400, 'Please provide a valid email address.');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.');
  }
  if (password !== confirmPassword) {
    throw new ApiError(400, 'Password and confirm password do not match.');
  }

  const validRoles = ['CREATOR', 'CONSUMER', 'MODERATOR'];
  const assignedRole = role && validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : 'CONSUMER';

  const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing.length > 0) {
    throw new ApiError(409, 'An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name.trim(), email.toLowerCase(), passwordHash, assignedRole]
  );

  const user = { user_id: result.insertId, name: name.trim(), email: email.toLowerCase(), role: assignedRole };
  const token = signToken(user);

  res.status(201).json({
    message: 'Account created successfully.',
    token,
    user: { id: user.user_id, name: user.name, email: user.email, role: user.role },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, expectedRole } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const [rows] = await pool.query(
    'SELECT user_id, name, email, role, password_hash FROM users WHERE email = ?',
    [email.toLowerCase()]
  );

  if (rows.length === 0) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (expectedRole && user.role !== expectedRole.toUpperCase()) {
    throw new ApiError(403, `This account is registered as ${user.role}. Please use the ${user.role} login portal.`);
  }

  const token = signToken(user);

  res.json({
    message: 'Login successful.',
    token,
    user: { id: user.user_id, name: user.name, email: user.email, role: user.role },
  });
});

const me = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT user_id, name, email, role, created_at FROM users WHERE user_id = ?',
    [req.user.userId]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'User not found.');
  }
  const u = rows[0];
  res.json({ id: u.user_id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at });
});

// Used by the frontend to populate the "grant right to user" dropdown.
const listUsers = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT user_id AS id, name, email FROM users WHERE user_id != ? ORDER BY name',
    [req.user.userId]
  );
  res.json(rows);
});

module.exports = { register, login, me, listUsers };
