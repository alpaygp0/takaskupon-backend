const express = require('express');
const router = express.Router();
const multer = require('multer');
const { scanCampaignImage } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// 🔥 KRİTİK GÜNCELLEME: Cloudinary yerine SADECE RAM (Memory) Depolaması
// Yapay zeka taraması için resmi buluta kaydetmeyiz, anlık olarak bellekte tutarız.
const uploadMem = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Maksimum 5MB
});

// Sadece giriş yapmış (protect) kullanıcılar resmi belleğe alıp taratabilir
router.post('/scan', protect, uploadMem.single('image'), scanCampaignImage);

module.exports = router;