const router = require('express').Router();
const controller = require('../controllers/candidate.controller');

router.get('/', controller.getCandidates);
router.put('/:id/status', controller.updateStatus);

module.exports = router;