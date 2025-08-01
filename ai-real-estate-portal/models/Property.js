const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
    location: {
        type: String,
        required: true,
        trim: true,
    },
    size: {
        type: Number,
        required: true,
        min: 0,
    },
    rooms: {
        type: Number,
        required: true,
        min: 0,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    type: {
        type: String,
        enum: ['house', 'flat', 'plot'],
        required: true,
    },
    image: {
        type: String,
        default: null,
    },
}, { timestamps: true });

module.exports = mongoose.model('Property', PropertySchema);
