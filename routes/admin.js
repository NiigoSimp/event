
// routes/admin.js
const express = require('express');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes protected and only for admin
router.use(protect);
router.use(authorize('admin'));

// 13. Tổng hợp trạng thái thanh toán theo sự kiện
router.get('/payment-summary/by-event', async (req, res) => {
    try {
        const paymentSummary = await Ticket.aggregate([
            {
                $group: {
                    _id: {
                        event: '$event',
                        paymentStatus: '$paymentStatus'
                    },
                    totalTickets: { $sum: '$quantity' },
                    totalAmount: { $sum: '$totalAmount' }
                }
            },
            {
                $group: {
                    _id: '$_id.event',
                    paymentStatuses: {
                        $push: {
                            status: '$_id.paymentStatus',
                            tickets: '$totalTickets',
                            amount: '$totalAmount'
                        }
                    },
                    totalTickets: { $sum: '$totalTickets' },
                    totalAmount: { $sum: '$totalAmount' }
                }
            },
            {
                $lookup: {
                    from: 'events',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'event'
                }
            },
            {
                $unwind: '$event'
            },
            {
                $project: {
                    eventName: '$event.title',
                    paymentStatuses: 1,
                    totalTickets: 1,
                    totalAmount: 1
                }
            },
            {
                $sort: { totalAmount: -1 }
            }
        ]);

        res.json({
            success: true,
            data: paymentSummary
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        const [
            totalUsers,
            totalEvents,
            totalTickets,
            totalRevenue,
            eventsByStatus,
            recentTickets
        ] = await Promise.all([
            User.countDocuments(),
            Event.countDocuments(),
            Ticket.countDocuments(),
            Ticket.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Event.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Ticket.find()
                .populate('event', 'title')
                .populate('user', 'name email')
                .sort({ bookedAt: -1 })
                .limit(10)
        ]);

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    totalEvents,
                    totalTickets,
                    totalRevenue: totalRevenue[0]?.total || 0
                },
                eventsByStatus,
                recentBookings: recentTickets
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;