const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const { upload } = require('../middleware/upload');
const controller = require('../controllers/admin.controller');

router.post('/login', controller.login);

// Everything below requires an admin token.
router.use(adminAuth);

router.get('/dashboard', controller.dashboard);
router.get('/analytics', controller.analytics);
router.get('/settings', controller.getSettings);
router.put('/settings', controller.updateSettings);
router.put('/settings/rate', controller.updateExchangeRate);
router.post(
  '/settings/homepage-feature-image',
  upload.single('image'),
  controller.uploadHomepageFeatureImage
);

router.get('/products', controller.listProducts);
router.post('/products', upload.array('images', 12), controller.createProduct);
router.put('/products/:id', upload.array('images', 12), controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);
router.put('/products/:id/images/:imageId/primary', controller.setPrimaryImage);
router.delete('/products/:id/images/:imageId', controller.deleteProductImage);

router.get('/categories', controller.listCategories);
router.post('/categories', controller.createCategory);
router.put('/categories/:id', controller.updateCategory);
router.post(
  '/categories/:id/home-image',
  upload.single('image'),
  controller.uploadCategoryHomeImage
);
router.delete('/categories/:id', controller.deleteCategory);

router.get('/orders', controller.listOrders);
router.delete('/orders', controller.clearOrders);
router.post('/orders/clear', controller.clearOrders);
router.get('/orders/:id', controller.getOrder);
router.put('/orders/:id/status', controller.updateOrderStatus);
router.delete('/orders/:id', controller.deleteOrder);
router.post('/orders/:id/delete', controller.deleteOrder);

router.put('/password', controller.changePassword);
router.get('/admins', controller.listAdmins);
router.post('/admins', controller.createAdmin);
router.delete('/admins/:id', controller.deleteAdmin);

router.get('/users', controller.listUsers);

router.get('/newsletter', controller.listNewsletter);
router.delete('/newsletter/:id', controller.deleteNewsletter);

module.exports = router;
