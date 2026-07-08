const router = require('express').Router();
const controller = require('../controllers/candidate.controller');

router.get('/', controller.getCandidates);
router.get('/admis', controller.getAdmis);
router.get('/refuses', controller.getRefuses);
router.get('/recommendations', controller.getRecommendations);

router.get('/details', controller.getAllCandidatesDetails);

router.get('/:id/details', controller.getCandidateDetails);

router.post('/:id/accept', controller.acceptCandidate);
router.post('/:id/reject', controller.rejectCandidate);
router.post('/:id/recommend', controller.recommendCandidate);

router.put('/:id/status', controller.updateStatus);

module.exports = router;