const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const books = require('./booksdb');
const scrypt = promisify(crypto.scrypt);
const regd_users = express.Router();
const users = [];
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

const isValid = (username) => users.some((user) => user.username === username);

async function registerUser(username, password) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9_-]{3,40}$/.test(username)
      || ['__proto__', 'constructor', 'prototype'].includes(username)
      || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw Object.assign(new Error('Provide a username of 3-40 letters, digits, underscores or hyphens and a password of 8-128 characters.'), { status: 400 });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  // Check after hashing so concurrent registrations cannot create duplicates.
  if (isValid(username)) throw Object.assign(new Error('Username already exists.'), { status: 409 });
  users.push({ username, salt, hash });
}

async function authenticatedUser(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128) return false;
  const user = users.find((candidate) => candidate.username === username);
  if (!user) return false;
  const hash = await scrypt(password, user.salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'));
}

regd_users.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!(await authenticatedUser(username, password))) return res.status(401).json({ message: 'Invalid username or password.' });
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.authorization = { token: jwt.sign({ username }, jwtSecret, { expiresIn: '1h', algorithm: 'HS256' }) };
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ message: 'Customer successfully logged in.', username });
      });
    });
  } catch (error) { next(error); }
});

function requireAuthentication(req, res, next) {
  try {
    const token = req.session?.authorization?.token;
    if (!token) return res.status(401).json({ message: 'Please log in first.' });
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (!isValid(payload.username)) return res.status(401).json({ message: 'User not found.' });
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
}

regd_users.use('/auth', requireAuthentication);
regd_users.put('/auth/review/:isbn', (req, res) => {
  const book = Object.hasOwn(books, req.params.isbn) && books[req.params.isbn];
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  const review = req.body.review ?? req.query.review;
  if (typeof review !== 'string' || !review.trim() || review.length > 5000) return res.status(400).json({ message: 'Provide a nonempty review of at most 5000 characters.' });
  const updated = Object.hasOwn(book.reviews, req.username);
  // Identity comes only from the verified session, never from the request body.
  book.reviews[req.username] = review.trim();
  res.json({ message: updated ? 'Book review successfully updated.' : 'Book review successfully added.', reviews: book.reviews });
});
regd_users.delete('/auth/review/:isbn', (req, res) => {
  const book = Object.hasOwn(books, req.params.isbn) && books[req.params.isbn];
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  if (!Object.hasOwn(book.reviews, req.username)) return res.status(404).json({ message: 'You have no review for this book.' });
  delete book.reviews[req.username];
  res.json({ message: 'Your book review was successfully deleted.', reviews: book.reviews });
});
module.exports = { authenticated: regd_users, isValid, authenticatedUser, registerUser, users };
