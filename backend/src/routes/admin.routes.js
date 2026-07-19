const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const { upload } = require('../middleware/upload');
const controller = require('../controllers/admin.controller');

router.post('/login', controller.login);

// Everything below requires an admin token.
router.use(adminAuth);

router.get('/dashboard', controller.dashboard);
router.get('/settings', controller.getSettings);
router.put('/settings', controller.updateSettings);

router.get('/products', controller.listProducts);
router.post('/products', upload.array('images', 5), controller.createProduct);
router.put('/products/:id', upload.array('images', 5), controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);
router.delete('/products/:id/images/:imageId', controller.deleteProductImage);

router.post('/categories', controller.createCategory);
router.put('/categories/:id', controller.updateCategory);
router.delete('/categories/:id', controller.deleteCategory);

router.get('/orders', controller.listOrders);
router.get('/orders/:id', controller.getOrder);
router.put('/orders/:id/status', controller.updateOrderStatus);

router.get('/users', controller.listUsers);

module.exports = router;
