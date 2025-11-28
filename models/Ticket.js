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
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash'],
        default: 'credit_card'
    },
    paymentDetails: {
        transactionId: String,
        paymentDate: Date,
        cardLastFour: String
    },
    bookedAt: {
        type: Date,
        default: Date.now
    },
    qrCode: String
}, {
    timestamps: true
});

// Index for better query performance
ticketSchema.index({ user: 1, bookedAt: -1 });
ticketSchema.index({ event: 1, paymentStatus: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);