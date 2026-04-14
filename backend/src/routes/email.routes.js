// src/routes/email.routes.js
const router = require('express').Router();
const controller = require('../controllers/email.controller');

router.get('/fetch', controller.processEmails);

module.exports = router;