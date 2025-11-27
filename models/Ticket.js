// models/Ticket.js
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ticketNumber: {
        type: String,
        unique: true,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: String,
    bookedAt: {
        type: Date,
        default: Date.now
    }
});

ticketSchema.index({ event: 1, user: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);