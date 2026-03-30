const express = require('express');
const router = express.Router();

// 1. Motorları (Controller) İçe Aktar
const { 
    registerUser, 
    verifyEmail, 
    loginUser, 
    googleLogin, 
    forgotPassword, 
    resetPassword, 
    getMe, 
    updateProfile, 
    updatePassword,
    submitSupportTicket,
    getMyNotifications, markNotificationsAsRead,
    getMyTransactions // YENİ: Kredi geçmişi dekont motoru
} = require('../controllers/authController');

// 2. Güvenlik ve Dosya Yükleme Katmanlarını (Middleware) İçe Aktar
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware'); // Sadece avatar yüklerken kullanılacak

// ==========================================
// 1. KAYIT VE GİRİŞ (AUTH) KAPILARI
// ==========================================
// Herkese açık rotalar (Protect YOK)
router.post('/register', registerUser);
router.post('/verify', verifyEmail);
router.post('/login', loginUser);
router.post('/google', googleLogin);

// ==========================================
// 2. ŞİFRE SIFIRLAMA KAPILARI
// ==========================================
// Herkese açık rotalar (Protect YOK)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// ==========================================
// 3. PROFİL VE HESAP YÖNETİMİ KAPILARI
// ==========================================
// Bu rotalara sadece giriş yapmış (Token'ı olan) kullanıcılar girebilir (Protect VAR)

// Mevcut kullanıcının kendi bilgilerini getirmesi
router.get('/me', protect, getMe);

// Profil güncelleme (FormData formatında ve Görsel içerdiği için upload.single('avatar') kullanıyoruz)
router.put('/update', protect, upload.single('avatar'), updateProfile);

// Güvenli şifre değiştirme (Sadece metin/JSON içerdiği için çevirmene gerek yok)
router.put('/update-password', protect, updatePassword);

// ==========================================
// 4. FİNANSAL GEÇMİŞ (DEKONT) KAPISI
// ==========================================
// Kullanıcının sistemdeki tüm kredi kazanma ve harcama geçmişini getirir
router.get('/transactions', protect, getMyTransactions);
router.post('/support', submitSupportTicket);
router.get('/notifications', protect, getMyNotifications);
router.put('/notifications/read', protect, markNotificationsAsRead);
module.exports = router;