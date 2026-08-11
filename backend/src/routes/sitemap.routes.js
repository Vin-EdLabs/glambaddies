const express = require('express');
const controller = require('../controllers/sitemap.controller');

const router = express.Router();

router.get('/sitemap.xml', controller.getSitemap);

module.exports = router;
