const User = require('../models/User');
const Transaction = require('../models/Transaction'); // Finansal Geçmiş (Dekont) Modeli
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const Notification = require('../models/Notification');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==========================================
// YARDIMCI FONKSİYONLAR (GÜVENLİK VE MAİL)
// ==========================================

// E-posta Gönderme Motoru (Nodemailer)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
    }
});

// Güvenli JWT Token Oluşturucu (30 Gün Geçerli)
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Şık ve Kurumsal E-Posta Şablonu Gönderici
const sendEmailCode = async (email, code, subject, title) => {
    await transporter.sendMail({
        from: `"TakasKupon A.Ş." <${process.env.EMAIL_USER}>`, 
        to: email, 
        subject: subject,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w-md; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #f8fafc; text-align: center;">
                <div style="width: 60px; height: 60px; background-color: #4f46e5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin: 0 auto 20px;">
                    T
                </div>
                <h2 style="color: #1e293b; margin-bottom: 10px;">${title}</h2>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 25px;">İşleminize devam etmek için aşağıdaki güvenlik kodunu kullanın:</p>
                <div style="background-color: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                    <h1 style="color: #4f46e5; letter-spacing: 8px; margin: 0; font-size: 32px;">${code}</h1>
                </div>
                <p style="color: #94a3b8; font-size: 12px;">Bu kodun geçerlilik süresi 10 dakikadır. Güvenliğiniz için bu kodu kimseyle paylaşmayın.</p>
            </div>
        `
    });
};

const registerUser = async (req, res) => {
    try {
        // Artık email yerine 'identifier' alıyoruz
        const { name, identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Tüm alanları doldurun.' });
        }

        // Gelen verinin E-posta mı yoksa Telefon mu olduğunu anlayan Regex Zekası
        const isEmail = identifier.includes('@');
        
        // Veritabanında çakışma kontrolü
        const query = isEmail ? { email: identifier } : { phone: identifier };
        const userExists = await User.findOne(query);

        if (userExists) {
            return res.status(409).json({ message: 'Bu iletişim adresi zaten kullanımda.' });
        }

        // Şifre Hashleme
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Kullanıcıyı oluştur (E-posta ise email'e, Telefon ise phone'a kaydet)
        const newUser = await User.create({
            name,
            email: isEmail ? identifier : undefined,
            phone: !isEmail ? identifier : undefined,
            password: hashedPassword
        });

        // 🔥 BURADA NORMALDE SMS VEYA MAİL İLE OTP GÖNDERİLİR
        // Şimdilik OTP simülasyonu yapıyoruz ve başarılı dönüyoruz
        res.status(201).json({ message: 'Kayıt başarılı, doğrulama bekleniyor.' });

    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası: ' + error.message });
    }
};
const verifyEmail = async (req, res) => {
    try {
        const { email, code } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || user.verificationCode !== code) {
            return res.status(400).json({ message: 'Geçersiz doğrulama kodu.' });
        }
        if (user.codeExpires < Date.now()) {
            return res.status(400).json({ message: 'Kodun süresi dolmuş. Lütfen tekrar kayıt olarak yeni kod alın.' });
        }

        // Hesabı onayla ve kodları temizle
        user.isVerified = true; 
        user.verificationCode = undefined; 
        user.codeExpires = undefined;
        await user.save();

        res.status(200).json({ 
            _id: user.id, 
            name: user.name, 
            email: user.email, 
            balance: user.balance, 
            avatar: user.avatar, 
            notifications: user.notifications, 
            token: generateToken(user._id) 
        });
    } catch (error) { 
        res.status(500).json({ message: 'Doğrulama işlemi sırasında hata oluştu.' }); 
    }
};

const loginUser = async (req, res) => {
    try {
        // Frontend'den gelen 'identifier' (Tel veya Mail)
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Lütfen bilgileri eksiksiz girin.' });
        }

        // Akıllı Arama: Hem email hem phone alanında ara
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { phone: identifier }
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'Sistemde böyle bir kullanıcı bulunamadı.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Şifreniz hatalı.' });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Hesabınız askıya alınmıştır.' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone, // YENİ: Telefon bilgisini de frontend'e yolla
            balance: user.balance,
            trustScore: user.trustScore,
            avatar: user.avatar,
            notifications: user.notifications,
            token
        });

    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
};
const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        
        // Google'dan gelen bileti doğrula
        const ticket = await googleClient.verifyIdToken({ 
            idToken: credential, 
            audience: process.env.GOOGLE_CLIENT_ID 
        });
        const { email, name, sub: googleId, picture } = ticket.getPayload();

        let user = await User.findOne({ email });
        
        if (!user) {
            // Sisteme ilk kez Google ile giriyorsa direkt onaylı kayıt et
            user = await User.create({ 
                name, 
                email, 
                googleId, 
                isVerified: true, 
                avatar: picture 
            });
        } else if (!user.isVerified) { 
            // Daha önce maille kaydolup onaylamadıysa, Google ile girince onayla
            user.isVerified = true; 
            if (!user.avatar && picture) user.avatar = picture;
            await user.save(); 
        }

        res.status(200).json({ 
            _id: user.id, 
            name: user.name, 
            email: user.email, 
            balance: user.balance, 
            avatar: user.avatar, 
            notifications: user.notifications, 
            token: generateToken(user._id) 
        });
    } catch (error) { 
        console.error("🚨 Google Auth Hatası:", error);
        res.status(400).json({ message: 'Google ile güvenli giriş başarısız oldu.' }); 
    }
};

// ==========================================
// 3. ŞİFRE SIFIRLAMA MOTORLARI
// ==========================================
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'Bu e-posta adresine ait bir hesap bulunamadı.' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordCode = code; 
        user.codeExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        await sendEmailCode(email, code, 'TakasKupon - Şifre Sıfırlama', 'Şifre Sıfırlama Talebi');
        res.status(200).json({ message: 'Şifre sıfırlama kodu e-postanıza gönderildi.' });
    } catch (error) { 
        res.status(500).json({ message: 'İşlem başarısız oldu.' }); 
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const user = await User.findOne({ email });

        if (!user || user.resetPasswordCode !== code) {
            return res.status(400).json({ message: 'Geçersiz doğrulama kodu.' });
        }
        if (user.codeExpires < Date.now()) {
            return res.status(400).json({ message: 'Kodun geçerlilik süresi dolmuş.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordCode = undefined; 
        user.codeExpires = undefined;
        await user.save();
        
        res.status(200).json({ message: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
    } catch (error) { 
        res.status(500).json({ message: 'Şifre sıfırlama işlemi başarısız.' }); 
    }
};

// ==========================================
// 4. PROFİL GETİRME VE GÜNCELLEME (MULTER UYUMLU)
// ==========================================
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Kullanıcı bilgileri alınamadı.' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

        // Frontend'den gelen veriler
        if (req.body.name) user.name = req.body.name;
        if (req.body.phone) user.phone = req.body.phone; // YENİ: Telefon numarasını kaydet

        if (req.body.tradeAlerts !== undefined) {
            if (!user.notifications) user.notifications = {};
            user.notifications.tradeAlerts = req.body.tradeAlerts === 'true';
        }
        if (req.body.systemEmails !== undefined) {
            if (!user.notifications) user.notifications = {};
            user.notifications.systemEmails = req.body.systemEmails === 'true';
        }

        if (req.file) {
            user.avatar = req.file.path.replace(/\\/g, '/');
        }

        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: 'Profil başarıyla güncellendi.',
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone, // Güncel telefonu yolla
            balance: user.balance,
            avatar: user.avatar,
            notifications: user.notifications,
            token
        });
    } catch (error) {
        res.status(500).json({ message: 'Güncelleme başarısız.' });
    }
};
const updatePassword = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const { currentPassword, newPassword } = req.body;

        // Kullanıcının hali hazırda bir şifresi varsa (Google ile girmediyse) mevcut şifreyi doğrula
        if (user.password) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Mevcut şifrenizi yanlış girdiniz! Güvenlik ihlali engellendi.' });
            }
        }
const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save(); 

        res.json({ message: 'Şifreniz başarıyla ve güvenle güncellendi. 🔒' });
    } catch (error) {
        res.status(500).json({ message: 'Şifre güncellenirken bir hata oluştu.' });
    }
};

// ==========================================
// 5. YENİ: FİNANSAL GEÇMİŞ (KREDİ DEKONTU) MOTORU
// ==========================================
const getMyTransactions = async (req, res) => {
    try {
        // Kullanıcıya ait tüm kredi hareketlerini en yeniden eskiye sıralı olarak getir
        const transactions = await Transaction.find({ user: req.user._id })
            .sort('-createdAt')
            .populate('relatedCampaign', 'brand title'); // Gerekirse ilan başlığını da çekebiliriz
            
        res.status(200).json(transactions);
    } catch (error) {
        console.error("🚨 Kredi Geçmişi Çekme Hatası:", error);
        res.status(500).json({ message: 'Kredi işlem geçmişiniz alınamadı. Sunucu hatası.' });
    }
};

// ==========================================
// DESTEK TALEBİ GÖNDERME MOTORU
// ==========================================
const submitSupportTicket = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: 'Lütfen zorunlu alanları doldurun.' });
        }

        // Admin'e (Sana) gidecek e-posta şablonu
        await transporter.sendMail({
            from: `"TakasKupon Destek Sistemi" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Kendi mailine gönderiyorsun
            replyTo: email, // Cevapla dediğinde kullanıcının mailine gitsin
            subject: `🚨 YENİ DESTEK TALEBİ: ${subject || 'Konu Belirtilmemiş'}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4f46e5;">Yeni Destek Mesajı</h2>
                    <p><strong>Gönderen:</strong> ${name} (${email})</p>
                    <p><strong>Konu:</strong> ${subject}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="white-space: pre-wrap; color: #333;">${message}</p>
                </div>
            `
        });

        res.status(200).json({ message: 'Mesajınız destek ekibimize başarıyla ulaştı. En kısa sürede dönüş yapacağız! 🚀' });
    } catch (error) {
        console.error("🚨 Destek Mesajı Gönderme Hatası:", error);
        res.status(500).json({ message: 'Mesajınız iletilemedi. Lütfen daha sonra tekrar deneyin.' });
    }
};

// ==========================================
// BİLDİRİM MERKEZİ MOTORLARI
// ==========================================
const getMyNotifications = async (req, res) => {
    try {
        // En yeni 30 bildirimi getir
        const notifications = await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30);
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Bildirimler alınamadı.' });
    }
};

const markNotificationsAsRead = async (req, res) => {
    try {
        // Kullanıcının tüm okunmamış bildirimlerini "okundu" yap
        await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
        res.status(200).json({ message: 'Tümü okundu olarak işaretlendi.' });
    } catch (error) {
        res.status(500).json({ message: 'İşlem başarısız.' });
    }
};

module.exports = { 
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
    getMyNotifications,
    markNotificationsAsRead,
    getMyTransactions // Finansal modül dışa aktarıldı
};