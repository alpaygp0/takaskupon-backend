const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    proofImage: { type: String }, // Kullanıcının yükleyeceği kanıt görselinin yolu
    status: { type: String, enum: ['bekliyor', 'onaylandi', 'reddedildi'], default: 'bekliyor' }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);