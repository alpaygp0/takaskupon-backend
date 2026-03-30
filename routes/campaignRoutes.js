const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { protect } = require('../middleware/authMiddleware');

// Doğru resim yükleme motorumuzu çağırıyoruz (HATA BURADAN GİDERİLDİ)
const upload = require('../middleware/uploadMiddleware'); 

// ==========================================
// KAMPANYA VE TAKAS ROTALARI
// ==========================================

// Admin: Bekleyen şikayetleri getir
router.get('/reports/pending', protect, campaignController.getPendingReports);

// Vitrin: Sadece aktif ve süresi geçmemiş ilanları getir
router.get('/', campaignController.getActiveCampaigns);

// Yeni İlan Yükle
router.post('/', protect, upload.single('image'), campaignController.createCampaign);

// Çelik Kasa: İlanı Takas Et (Satın Al)
router.post('/:id/trade', protect, campaignController.tradeCampaign);

// Kullanıcı Paneli: Kendi Yüklediklerim ve Satın Aldıklarım
router.get('/my-campaigns', protect, campaignController.getMyCampaigns);
router.get('/my-purchases', protect, campaignController.getMyPurchases);
router.delete('/:id', protect, campaignController.deleteCampaign);
// YENİ EKLENEN SATIR: Profil Modalı için birleştirilmiş veri rotası
router.get('/profile-data', protect, campaignController.getProfileData);
// Şikayet Sistemi
router.post('/:id/report', protect, upload.single('proofImage'), campaignController.reportCampaign);
router.post('/resolve-report', protect, campaignController.resolveReport);

module.exports = router;