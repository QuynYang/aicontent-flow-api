const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/CampaignController');

// Khai báo các endpoints cho từng trang
router.post('/init', campaignController.initCampaign.bind(campaignController));       // Trang 1
router.post('/outline', campaignController.generateOutline.bind(campaignController)); // Trang 2
router.post('/detail', campaignController.generateDetail.bind(campaignController));   // Trang 3

router.get('/:id/status', campaignController.getCampaignStatus.bind(campaignController));

module.exports = router;