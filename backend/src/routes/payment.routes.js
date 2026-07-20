const router = require('express').Router();
const checkoutAuth = require('../middleware/checkoutAuth');
const controller = require('../controllers/payment.controller');

router.use(checkoutAuth);

router.post('/prepare', controller.prepare);
router.post('/initialize', controller.initialize);
router.get('/verify/:reference', controller.verify);

module.exports = router;
