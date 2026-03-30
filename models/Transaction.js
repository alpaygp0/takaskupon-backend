const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }, // Gelecekte +3, -5 olabilmesi için Number yapıyoruz
    type: { type: String, enum: ['kazanc', 'harcama'], required: true },
    source: { 
        type: String, 
        enum: ['ilan_ekleme', 'takas', 'sikayet_odulu', 'ilan_silme', 'video_izleme', 'sistem_hediyesi'],
        required: true 
    },
    description: { type: String, required: true }, // Örn: "Trendyol 50 TL ilanı yüklendi."
    relatedCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' } // Hangi ilanla ilgiliydi? (İsteğe bağlı)
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);