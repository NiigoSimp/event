// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    location: {
        venue: {
            type: String,
            required: true
        },
        address: {
            street: String,
            city: String,
            country: String
        },
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    dateTime: {
        start: {
            type: Date,
            required: true
        },
        end: {
            type: Date,
            required: true
        }
    },
    organizer: {
        name: {
            type: String,
            required: true
        },
        contact: {
            email: String,
            phone: String
        }
    },
    capacity: {
        type: Number,
        required: true
    },
    ticketPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    images: [String],
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Event', eventSchema);