const express = require('express');
const axios = require('axios');
const books = require('./booksdb');
const { registerUser } = require('./auth_users');
const public_users = express.Router();

public_users.post('/register', async (req, res, next) => {
  try {
    await registerUser(req.body.username, req.body.password);
    res.status(201).json({ message: 'User successfully registered. You can now log in.' });
  } catch (error) { next(error); }
});
public_users.get('/', (req, res) => res.json(books));
public_users.get('/isbn/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  res.json(books[req.params.isbn]);
});
function searchBooks(field, value) {
  return Object.fromEntries(Object.entries(books).filter(([, book]) => book[field].toLowerCase() === value.toLowerCase()));
}
public_users.get('/author/:author', (req, res) => res.json(searchBooks('author', req.params.author)));
public_users.get('/title/:title', (req, res) => res.json(searchBooks('title', req.params.title)));
public_users.get('/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  res.json(books[req.params.isbn].reviews);
});

// Four asynchronous Axios methods. These are client operations separate from
// the route handlers, so HTTP requests do not recursively call themselves.
// An optional base URL also permits integration testing on an ephemeral port.
function createBookClient(baseURL = process.env.BOOKSHOP_URL || 'http://127.0.0.1:5000') {
  const client = axios.create({ baseURL, timeout: 10000, proxy: false });

  // Task 10: async/await with an optional error-first callback.
  async function getAllBooks(callback) {
    let result;
    try { result = (await client.get('/')).data; }
    catch (error) {
      if (callback) { callback(error); return; }
      throw error;
    }
    if (callback) callback(null, result);
    return result;
  }
  // Task 11: return the promise supplied by Axios.
  function getBookByISBN(isbn) {
    return client.get('/isbn/' + encodeURIComponent(isbn)).then((response) => response.data);
  }
  // Tasks 12 and 13: asynchronous author and title searches.
  async function getBooksByAuthor(author) {
    const response = await client.get('/author/' + encodeURIComponent(author));
    return response.data;
  }
  async function getBooksByTitle(title) {
    const response = await client.get('/title/' + encodeURIComponent(title));
    return response.data;
  }
  return { getAllBooks, getBookByISBN, getBooksByAuthor, getBooksByTitle };
}
module.exports = { general: public_users, createBookClient, ...createBookClient() };
