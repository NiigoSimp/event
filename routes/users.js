// routes/users.js
const express = require('express');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// 4. Lấy thông tin người dùng và số vé đã đăng ký
router.get('/:userId/profile', protect, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check if user is accessing their own profile or is admin
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this user profile'
            });
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const ticketStats = await Ticket.aggregate([
            {
                $match: { user: mongoose.Types.ObjectId(userId) }
            },
            {
                $group: {
                    _id: '$paymentStatus',
                    totalTickets: { $sum: '$quantity' },
                    totalAmount: { $sum: '$totalAmount' }
                }
            }
        ]);

        const totalTickets = ticketStats.reduce((sum, stat) => sum + stat.totalTickets, 0);

        res.json({
            success: true,
            data: {
                user,
                ticketStats: {
                    totalTickets,
                    byStatus: ticketStats
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

// 5. Tìm thông tin khách hàng theo email
router.get('/search/by-email', protect, authorize('admin'), async (req, res) => {
    try {
        const { email, page = 1, limit = 10 } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email parameter is required'
            });
        }

        const users = await User.find({
            email: { $regex: email, $options: 'i' }
        })
            .select('-password')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 7. Lấy lịch sử đăng ký của khách hàng
router.get('/:userId/booking-history', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        // Check authorization
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this booking history'
            });
        }

        const bookings = await Ticket.find({ user: userId })
            .populate({
                path: 'event',
                select: 'title dateTime.start dateTime.end location.venue'
            })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ bookedAt: -1 });

        const totalBookings = await Ticket.countDocuments({ user: userId });

        res.json({
            success: true,
            data: {
                bookings,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalBookings,
                    pages: Math.ceil(totalBookings / limit)
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

module.exports = router;