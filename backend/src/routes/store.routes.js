const router = require('express').Router();
const controller = require('../controllers/store.controller');

router.get('/status', controller.getStatus);

module.exports = router;
