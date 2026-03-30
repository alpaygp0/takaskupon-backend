const Campaign = require('../models/Campaign');
const User = require('../models/User');
const Report = require('../models/Report');
const Transaction = require('../models/Transaction'); // Finansal Geçmiş
const Notification = require('../models/Notification'); // YENİ: Bildirim Merkezi
const mongoose = require('mongoose');

// ==========================================
// 1. İLAN YÜKLEME (KREDİ KAZANDIRIR)
// ==========================================
const createCampaign = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Lütfen kampanya görseli yükleyin.' });

        const { brand, title, code, description, category, expiryDate } = req.body;
        
        const newCampaign = await Campaign.create({
            owner: req.user._id, brand, title, code, description, category, expiryDate, imageUrl: req.file.path
        });

        const user = await User.findById(req.user._id);
        user.balance += 1;
        await user.save();

        // 🔥 MUHASEBE KAYDI
        await Transaction.create({
            user: user._id, amount: 1, type: 'kazanc', source: 'ilan_ekleme',
            description: `${brand} kampanyasını havuza eklediniz.`, relatedCampaign: newCampaign._id
        });

        res.status(201).json({ message: 'İlan eklendi ve 1 kredi kazandınız!', campaign: newCampaign, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ message: 'Yükleme sırasında bir hata oluştu.' });
    }
};

// ==========================================
// 2. GELİŞMİŞ VİTRİN: SAYFALAMA VE FİLTRELEME
// ==========================================
const getActiveCampaigns = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 12 } = req.query;
        let query = { status: 'aktif', expiryDate: { $gt: new Date() } };

        if (category && category !== 'Tümü') query.category = category;
        if (search) {
            query.$or = [
                { brand: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const campaigns = await Campaign.find(query)
            .select('-code') // Şifreler vitrinde asla gönderilmez
            .populate('owner', 'trustScore')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Campaign.countDocuments(query);

        res.status(200).json({
            campaigns, currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)), totalCampaigns: total
        });
    } catch (error) { 
        res.status(500).json({ message: 'İlanlar yüklenirken sunucu hatası oluştu.' }); 
    }
};

// ==========================================
// 3. GERÇEK ÇELİK KASA (TAKAS VE BİLDİRİM)
// ==========================================
const tradeCampaign = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const campaignId = req.params.id;
        const buyerId = req.user._id;

        const campaign = await Campaign.findById(campaignId).session(session);
        if (!campaign) throw new Error('İlan bulunamadı.');
        if (campaign.status !== 'aktif') throw new Error('Bu kampanya zaten alınmış veya süresi dolmuş.');
        if (campaign.owner.toString() === buyerId.toString()) throw new Error('Kendi ilanınızı satın alamazsınız.');

        const buyer = await User.findById(buyerId).session(session);
        const seller = await User.findById(campaign.owner).session(session);

        if (buyer.balance < 1) throw new Error('Yetersiz bakiye. Takas için en az 1 krediniz olmalıdır.');

        buyer.balance -= 1;
        seller.balance += 1;
        campaign.status = 'takaslandı';
        campaign.buyer = buyerId;

        await buyer.save({ session });
        await seller.save({ session });
        await campaign.save({ session });

        // Muhasebe Kaydı
        await Transaction.create([{
            user: buyerId, amount: 1, type: 'harcama', source: 'takas',
            description: `${campaign.brand} kampanyasını satın aldınız.`, relatedCampaign: campaign._id
        }], { session });

        // 🔥 YENİ: SATICI İÇİN KALICI BİLDİRİM KAYDI
        const notif = new Notification({
            user: campaign.owner,
            title: 'İlanınız Satıldı! 🎉',
            message: `${campaign.brand} kampanyanız bir kullanıcı tarafından alındı.`,
            type: 'info'
        });
        await notif.save({ session });

        // İşlemleri Kasada Onayla
        await session.commitTransaction(); 
        session.endSession();

        // 🔥 YENİ: SATICIYA ANLIK (REAL-TIME) SİNYAL FIRLAT
        const io = req.app.get('io');
        const connectedUsers = req.app.get('connectedUsers');
        
        if (io && connectedUsers) {
            const sellerSocket = connectedUsers.get(campaign.owner.toString());
            if (sellerSocket) {
                io.to(sellerSocket).emit('realtime_notification', notif); // Bildirimi anında ekrana yansıt
            }
        }

        res.status(200).json({ message: 'Takas başarılı!', secretCode: campaign.code, brand: campaign.brand, newBalance: buyer.balance });
    } catch (error) {
        await session.abortTransaction(); 
        session.endSession();
        res.status(400).json({ message: error.message });
    }
};

// ==========================================
// 4. KULLANICI İLAN SİLME (KREDİ İADESİ)
// ==========================================
const deleteCampaign = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const campaignId = req.params.id;
        const userId = req.user._id;

        const campaign = await Campaign.findById(campaignId).session(session);
        if (!campaign) throw new Error('İlan bulunamadı.');
        if (campaign.owner.toString() !== userId.toString()) throw new Error('Bu ilanı silme yetkiniz yok.');
        if (campaign.status !== 'aktif') throw new Error('Satılmış veya süresi dolmuş ilanlar silinemez.');

        const user = await User.findById(userId).session(session);
        if (user.balance < 1) throw new Error('Bu ilanı sistemden çekmek için hesabınızda en az 1 kredi bulunmalıdır.');

        user.balance -= 1; 
        await user.save({ session });
        
        await Campaign.findByIdAndDelete(campaignId).session(session);

        await Transaction.create([{
            user: userId, amount: 1, type: 'harcama', source: 'ilan_silme',
            description: `İlanı sildiğiniz için yükleme kredisi iade alındı.`, relatedCampaign: campaignId
        }], { session });

        await session.commitTransaction(); 
        session.endSession();

        res.status(200).json({ message: 'İlan silindi ve 1 kredi düşüldü.', newBalance: user.balance });
    } catch (error) {
        await session.abortTransaction(); 
        session.endSession();
        res.status(400).json({ message: error.message });
    }
};

// ==========================================
// 5. ŞİKAYET OLUŞTURMA MOTORU (ANTI-SPAM)
// ==========================================
const reportCampaign = async (req, res) => {
    try {
        const campaignId = req.params.id;
        const reporterId = req.user._id;
        const { reason } = req.body;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) return res.status(404).json({ message: 'Kampanya bulunamadı.' });

        if (campaign.reportStatus === 'pending') return res.status(400).json({ message: 'Bu ilanla ilgili şikayetiniz inceleme aşamasında. ⏳' });
        if (campaign.reportStatus === 'rejected') return res.status(403).json({ message: 'Şikayetiniz reddedilmiş. Tekrar şikayet edemezsiniz. 🚫' });
        if (campaign.reportStatus === 'approved') return res.status(400).json({ message: 'Şikayetiniz zaten onaylanmış. ✅' });

        if (!campaign.buyer || campaign.buyer.toString() !== reporterId.toString()) return res.status(403).json({ message: 'Sadece satın aldığınız kodları şikayet edebilirsiniz.' });
        if (!reason) return res.status(400).json({ message: 'Lütfen sebep belirtin.' });

        await Report.create({ campaign: campaignId, reporter: reporterId, reportedUser: campaign.owner, reason, proofImage: req.file ? req.file.path : null });

        campaign.isReported = true;
        campaign.reportStatus = 'pending';
        await campaign.save();

        res.status(200).json({ message: 'Şikayetiniz kanıtlarla birlikte yönetime iletildi.' });
    } catch (error) { res.status(500).json({ message: 'Şikayet oluşturulamadı.' }); }
};

// ==========================================
// 6. ADMİN: ŞİKAYET ÇÖZÜMLEME (ÖDÜL VE BİLDİRİM)
// ==========================================
const resolveReport = async (req, res) => {
    try {
        const { reportId, action } = req.body;
        const report = await Report.findById(reportId).populate('reportedUser reporter campaign');
        
        if (!report) return res.status(404).json({ message: 'Şikayet bulunamadı.' });

        if (action === 'approve') {
            report.status = 'onaylandi';
            report.campaign.reportStatus = 'approved';
            
            // Satıcıya Ceza
            report.reportedUser.trustScore -= 20;
            if (report.reportedUser.trustScore <= 0) report.reportedUser.isBanned = true;
            await report.reportedUser.save();
            
            // Şikayetçiye Ödül
            report.reporter.balance += 1;
            await report.reporter.save();

            // Muhasebe Kaydı
            await Transaction.create({
                user: report.reporter._id, amount: 1, type: 'kazanc', source: 'sikayet_odulu',
                description: `Haksız bir ilanı bildirdiğiniz için krediniz iade edildi.`, relatedCampaign: report.campaign._id
            });

            // 🔥 YENİ: ŞİKAYETÇİYE KALICI BİLDİRİM KAYDI
            const notif = await Notification.create({
                user: report.reporter._id,
                title: 'Şikayetiniz Haklı Bulundu! ⚖️',
                message: `Bildirdiğiniz ilan kuraldışı bulundu. 1 Kredi hesabınıza iade edildi!`,
                type: 'success'
            });

            // 🔥 YENİ: ŞİKAYETÇİYE ANLIK (REAL-TIME) SİNYAL FIRLAT
            const io = req.app.get('io');
            const connectedUsers = req.app.get('connectedUsers');
            if (io && connectedUsers) {
                const reporterSocket = connectedUsers.get(report.reporter._id.toString());
                if (reporterSocket) {
                    // Cüzdan bilgisini de ekleyerek anlık güncelleme yaptır
                    io.to(reporterSocket).emit('realtime_notification', { ...notif._doc, newBalance: report.reporter.balance });
                }
            }

        } else if (action === 'reject') {
            report.status = 'reddedildi';
            report.campaign.reportStatus = 'rejected';
        }

        await report.campaign.save();
        await report.save();
        res.status(200).json({ message: 'Yönetici kararı başarıyla uygulandı.' });
    } catch (error) { res.status(500).json({ message: 'Karar uygulanırken hata oluştu.' }); }
};

const getPendingReports = async (req, res) => {
    try {
        const reports = await Report.find({ status: 'bekliyor' })
            .populate('campaign', 'brand code')
            .populate('reporter', 'email')
            .populate('reportedUser', 'email trustScore isBanned')
            .sort('-createdAt');
        res.status(200).json(reports);
    } catch (error) { res.status(500).json({ message: 'Şikayetler yüklenemedi.' }); }
};

// ==========================================
// 7. PROFİL MODALI MERKEZİ VERİ ÇEKİMİ
// ==========================================
const getProfileData = async (req, res) => {
    try {
        const userId = req.user._id;

        const rawUploads = await Campaign.find({ owner: userId }).sort('-createdAt');
        const uploads = rawUploads.map(camp => ({
            ...camp._doc,
            isSold: camp.status === 'takaslandı'
        }));

        const purchases = await Campaign.find({ buyer: userId }).sort('-createdAt');

        res.status(200).json({ uploads, purchases });
    } catch (error) { 
        res.status(500).json({ message: 'Profil verileri yüklenirken hata oluştu.' }); 
    }
};

// Yedek / Eski Listeleme Motorları
const getMyCampaigns = async (req, res) => {
    try {
        const campaigns = await Campaign.find({ owner: req.user._id }).sort('-createdAt');
        res.status(200).json(campaigns);
    } catch (error) { res.status(500).json({ message: 'Hata oluştu.' }); }
};

const getMyPurchases = async (req, res) => {
    try {
        const purchases = await Campaign.find({ buyer: req.user._id }).sort('-createdAt');
        res.status(200).json(purchases);
    } catch (error) { res.status(500).json({ message: 'Hata oluştu.' }); }
};

module.exports = { 
    createCampaign, getActiveCampaigns, tradeCampaign, deleteCampaign,
    getMyCampaigns, getMyPurchases, getProfileData,
    reportCampaign, resolveReport, getPendingReports 
};