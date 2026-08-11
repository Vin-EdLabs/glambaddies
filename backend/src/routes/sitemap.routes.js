const express = require('express');
const controller = require('../controllers/sitemap.controller');

const router = express.Router();

// Canonical public URL (nginx should proxy /sitemap.xml here)
router.get('/sitemap.xml', controller.getSitemap);
// Works through the existing /api proxy if root nginx location is missing
router.get('/api/sitemap.xml', controller.getSitemap);

module.exports = router;
