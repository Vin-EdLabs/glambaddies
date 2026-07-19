const router = require('express').Router();
const controller = require('../controllers/categories.controller');

router.get('/', controller.list);
router.get('/:idOrSlug', controller.getOne);

module.exports = router;
