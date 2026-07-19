const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/cart.controller');

router.use(auth);

router.get('/', controller.get);
router.post('/items', controller.addItem);
router.put('/items/:productId', controller.updateItem);
router.delete('/items/:productId', controller.removeItem);
router.delete('/', controller.clear);

module.exports = router;
