const express = require('express');
const session = require('express-session');
const { randomBytes } = require('node:crypto');
const customerRoutes = require('./router/auth_users').authenticated;
const generalRoutes = require('./router/general').general;

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use('/customer', session({
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 }
  }));
  app.use('/customer', customerRoutes);
  app.use('/', generalRoutes);
  app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
  app.use((error, req, res, next) => {
    const status = error.status || 500;
    res.status(status).json({ message: status < 500 ? error.message : 'Internal server error.' });
  });
  return app;
}
if (require.main === module) {
  const port = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => console.log('Bookshop API running at http://' + host + ':' + port));
}
module.exports = { createApp };
