// src/config/imap.js
const imaps = require('imap-simple');

const config = {
  imap: {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    host: process.env.IMAP_HOST,
    port: 993,
    tls: true,
    authTimeout: 3000,
  }
};

module.exports = { imaps, config };