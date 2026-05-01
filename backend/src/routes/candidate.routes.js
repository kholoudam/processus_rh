const router = require('express').Router();
const controller = require('../controllers/candidate.controller');

router.get('/', controller.getCandidates);
router.get('/:id/details', controller.getCandidateDetails);
// ✅ Accepter un candidat (déplace vers admis + email)
router.post('/:id/accept',controller.acceptCandidate);
// ❌ Refuser un candidat (déplace vers refuses + email)
router.post('/:id/reject',controller.rejectCandidate);
// Liste des admis
router.get('/admis',controller.getAdmis);
// Liste des refusés
router.get('/refuses',controller.getRefuses);
// Mise à jour du statut simple (conservé)
router.put('/:id/status',controller.updateStatus);
module.exports = router;