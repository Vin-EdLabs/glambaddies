const router = require('express').Router();
const controller = require('../controllers/products.controller');

// Never let browsers / proxies cache the product catalogue.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', controller.list);
router.get('/:idOrSlug', controller.getOne);

module.exports = router;
