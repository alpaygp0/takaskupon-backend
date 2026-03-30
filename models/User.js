const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    
    // 🔥 GÜNCELLEME: Omni-Auth için Email artık zorunlu (required) değil.
    email: { type: String, unique: true, sparse: true }, 
    
    // 🔥 YENİ: Telefon Numarası
    phone: { type: String, unique: true, sparse: true }, 

    password: { type: String }, // Google ile girişlerde şifre olmayabilir
    googleId: { type: String },
    
    avatar: { type: String }, // Profil Fotoğrafı URL'si
    balance: { type: Number, default: 0 }, // Takas Kredisi
    trustScore: { type: Number, default: 100 }, // Güven Puanı
    isBanned: { type: Boolean, default: false }, // Uzaklaştırma
    
    // Bildirim Tercihleri
    notifications: {
        tradeAlerts: { type: Boolean, default: true },
        systemEmails: { type: Boolean, default: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);