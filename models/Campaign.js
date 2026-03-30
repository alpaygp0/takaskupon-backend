const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  // Kampanyayı yükleyen kullanıcının ID'sini User modelinden çekiyoruz (İlişki kurma)
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  brand: { 
    type: String, 
    required: true // Örn: Madame Coco, Türk Telekom, Bubilet
  },
  title: { 
    type: String, 
    required: true // Örn: 1000 TL üzeri alışverişte %10 İndirim
  },
  code: { 
    type: String, 
    required: true // GERÇEK KOD (Sadece takas eden kişi görebilecek)
  },
  description: { 
    type: String // Kampanyanın kullanım koşulları (Yapay zeka burayı dolduracak)
  },
  category: {
    type: String,
    // Kullanıcının filtreleme yapabilmesi için sabit kategoriler belirliyoruz
    enum: ['Akaryakıt', 'Giyim', 'Eğlence', 'Market', 'Yemek', 'İnternet/Dakika', 'Diğer'],
    default: 'Diğer'
  },
  expiryDate: { 
    type: Date, 
    required: true // Son kullanma tarihi (Süresi dolanı havuzdan gizleyeceğiz)
  },
  imageUrl: { 
    type: String // Kullanıcının yüklediği ekran görüntüsünün linki/dosya yolu
  },
  status: {
    type: String,
    enum: ['aktif', 'takaslandı', 'süresi_doldu', 'reddedildi'],
    default: 'aktif' // İlk yüklendiğinde herkesin görebileceği aktif havuza düşer
  },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isReported: { type: Boolean, default: false },
  reportStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
}, { timestamps: true }); // İlanın ne zaman yüklendiğini otomatik tutar

module.exports = mongoose.model('Campaign', campaignSchema);