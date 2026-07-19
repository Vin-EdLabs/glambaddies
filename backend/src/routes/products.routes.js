const router = require('express').Router();
const controller = require('../controllers/products.controller');

router.get('/', controller.list);
router.get('/:idOrSlug', controller.getOne);

module.exports = router;
