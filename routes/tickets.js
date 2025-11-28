// routes/tickets.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');

// 🎫 COMPREHENSIVE TICKET PURCHASE FUNCTION
router.post('/purchase', protect, async (req, res) => {
    try {
        console.log('=== TICKET PURCHASE STARTED ===');
        console.log('User:', req.user._id);
        console.log('Request body:', req.body);

        const {
            eventId,
            quantity,
            paymentMethod = 'credit_card',
            paymentDetails = {}
        } = req.body;

        const userId = req.user._id;

        // Validate input
        if (!eventId || !quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Event ID and valid quantity are required'
            });
        }

        // Check if event exists and is available
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if event is still upcoming
        if (event.status !== 'upcoming') {
            return res.status(400).json({
                success: false,
                message: 'Cannot purchase tickets for completed or cancelled events'
            });
        }

        // Check ticket availability
        const ticketsSold = await Ticket.aggregate([
            {
                $match: {
                    event: new mongoose.Types.ObjectId(eventId),
                    paymentStatus: 'paid'
                }
            },
            {
                $group: {
                    _id: '$event',
                    totalTicketsSold: { $sum: '$quantity' }
                }
            }
        ]);

        const sold = ticketsSold[0]?.totalTicketsSold || 0;
        const available = event.capacity - sold;

        console.log(`Tickets - Capacity: ${event.capacity}, Sold: ${sold}, Available: ${available}, Requested: ${quantity}`);

        if (available < quantity) {
            return res.status(400).json({
                success: false,
                message: `Not enough tickets available. Only ${available} tickets left.`
            });
        }

        // Calculate total amount
        const totalAmount = quantity * event.ticketPrice;

        // Generate unique ticket number
        const ticketNumber = 'TICKET-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        // Simulate payment processing
        console.log('Processing payment...');

        // In a real application, you would integrate with payment gateway here
        // For demo purposes, we'll simulate successful payment
        const paymentSuccess = await simulatePaymentProcessing(totalAmount, paymentMethod, paymentDetails);

        if (!paymentSuccess) {
            return res.status(402).json({
                success: false,
                message: 'Payment processing failed. Please try again or use a different payment method.'
            });
        }

        // Create ticket with paid status
        const ticketData = {
            event: eventId,
            user: userId,
            ticketNumber,
            quantity,
            totalAmount,
            paymentStatus: 'paid',
            paymentMethod,
            paymentDetails: {
                transactionId: 'TX-' + Date.now(),
                paymentDate: new Date(),
                cardLastFour: paymentDetails.cardLastFour || '1234'
            },
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticketNumber}`
        };

        const ticket = await Ticket.create(ticketData);

        console.log('Ticket purchased successfully:', ticket._id);

        // Populate event details for response
        await ticket.populate('event', 'title dateTime location venue');

        res.status(201).json({
            success: true,
            message: 'Ticket purchased successfully!',
            data: {
                ticket: {
                    id: ticket._id,
                    ticketNumber: ticket.ticketNumber,
                    quantity: ticket.quantity,
                    totalAmount: ticket.totalAmount,
                    event: {
                        id: ticket.event._id,
                        title: ticket.event.title,
                        date: ticket.event.dateTime.start,
                        venue: ticket.event.location.venue
                    },
                    qrCode: ticket.qrCode,
                    bookedAt: ticket.bookedAt
                },
                receipt: {
                    transactionId: ticket.paymentDetails.transactionId,
                    paymentDate: ticket.paymentDetails.paymentDate,
                    paymentMethod: ticket.paymentMethod
                }
            }
        });

        console.log('=== TICKET PURCHASE COMPLETED ===');

    } catch (error) {
        console.error('Ticket purchase error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to purchase ticket',
            error: error.message
        });
    }
});

// Get user's purchased tickets
router.get('/my-tickets', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10, status } = req.query;

        let query = { user: userId };

        if (status) {
            query.paymentStatus = status;
        }

        const tickets = await Ticket.find(query)
            .populate({
                path: 'event',
                select: 'title dateTime.start dateTime.end location.venue location.city images'
            })
            .sort({ bookedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const totalTickets = await Ticket.countDocuments(query);

        res.json({
            success: true,
            data: {
                tickets,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalTickets,
                    pages: Math.ceil(totalTickets / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get ticket by ID
router.get('/:ticketId', protect, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const userId = req.user._id;

        const ticket = await Ticket.findOne({
            _id: ticketId,
            user: userId
        }).populate({
            path: 'event',
            select: 'title dateTime.start dateTime.end location.venue location.city organizer.name'
        });

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        res.json({
            success: true,
            data: ticket
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Cancel ticket (refund)
router.post('/:ticketId/cancel', protect, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const userId = req.user._id;

        const ticket = await Ticket.findOne({
            _id: ticketId,
            user: userId
        }).populate('event');

        if (!ticket) {
            return res.status(404).json({
                success: false,
                message: 'Ticket not found'
            });
        }

        // Check if ticket can be cancelled
        if (ticket.paymentStatus !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Only paid tickets can be cancelled'
            });
        }

        // Check if event is within cancellation period (e.g., 24 hours before event)
        const eventStart = new Date(ticket.event.dateTime.start);
        const now = new Date();
        const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);

        if (hoursUntilEvent < 24) {
            return res.status(400).json({
                success: false,
                message: 'Tickets can only be cancelled up to 24 hours before the event'
            });
        }

        // Update ticket status to refunded
        ticket.paymentStatus = 'refunded';
        await ticket.save();

        // Simulate refund processing
        console.log(`Refunding $${ticket.totalAmount} for ticket ${ticket.ticketNumber}`);

        res.json({
            success: true,
            message: 'Ticket cancelled successfully. Refund will be processed within 5-7 business days.',
            data: {
                refundAmount: ticket.totalAmount,
                ticketNumber: ticket.ticketNumber
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Simulate payment processing
async function simulatePaymentProcessing(amount, paymentMethod, paymentDetails) {
    try {
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // For demo purposes, we'll randomly fail 10% of payments
        const shouldFail = Math.random() < 0.1;

        if (shouldFail) {
            console.log('Payment simulation: FAILED');
            return false;
        }

        console.log(`Payment simulation: SUCCESS - $${amount} via ${paymentMethod}`);
        return true;
    } catch (error) {
        console.error('Payment processing error:', error);
        return false;
    }
}

module.exports = router;