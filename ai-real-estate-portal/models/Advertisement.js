const mongoose = require('mongoose');

const AdvertisementSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Advertisement', AdvertisementSchema);
