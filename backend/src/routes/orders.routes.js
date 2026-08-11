const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/orders.controller');

// Public — track with the phone number used at checkout (no sign-in).
router.get('/track', controller.trackByPhone);
router.get('/track/:phone', controller.trackByPhone);
// Public — guest checkout from bag items (optional customer JWT attaches to account).
router.post('/guest', controller.createGuest);

router.use(auth);

router.post('/', controller.create);
router.get('/', controller.listMine);
router.get('/:id', controller.getOne);

module.exports = router;
