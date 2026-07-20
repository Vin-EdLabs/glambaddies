const router = require('express').Router();
const controller = require('../controllers/store.controller');

router.get('/status', controller.getStatus);
router.post('/newsletter', controller.subscribeNewsletter);

module.exports = router;
