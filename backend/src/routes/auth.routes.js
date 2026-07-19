const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/auth.controller');

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', auth, controller.me);

module.exports = router;
