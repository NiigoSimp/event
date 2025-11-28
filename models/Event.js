// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Event description is required']
    },
    category: {
        type: String,
        required: [true, 'Event category is required']
    },
    location: {
        venue: { type: String, required: true },
        city: { type: String, required: true },
        country: { type: String, required: true }
    },
    dateTime: {
        start: { type: Date, required: true },
        end: { type: Date, required: true }
    },
    organizer: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true }
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    ticketPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    totalReviews: {
        type: Number,
        default: 0
    },
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Event', eventSchema);