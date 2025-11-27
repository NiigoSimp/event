// routes/events.js
const express = require('express');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// 1. Lấy danh sách sự kiện sắp diễn ra
router.get('/upcoming', async (req, res) => {
    try {
        const events = await Event.find({
            'dateTime.start': { $gte: new Date() },
            status: 'upcoming'
        })
            .populate('category', 'name')
            .sort('dateTime.start')
            .limit(50);

        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 2. Tìm sự kiện theo thể loại và địa điểm
router.get('/search', async (req, res) => {
    try {
        const { category, location, page = 1, limit = 10 } = req.query;

        let query = {};

        if (category) {
            const categoryDoc = await Category.findOne({
                name: { $regex: category, $options: 'i' }
            });
            if (categoryDoc) {
                query.category = categoryDoc._id;
            }
        }

        if (location) {
            query['location.venue'] = { $regex: location, $options: 'i' };
        }

        const events = await Event.find(query)
            .populate('category', 'name')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort('dateTime.start');

        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 3. Đếm số lượng sự kiện theo trạng thái
router.get('/count-by-status', protect, authorize('admin'), async (req, res) => {
    try {
        const statusCount = await Event.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: statusCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 6. Đếm số vé đã bán cho một sự kiện
router.get('/:eventId/tickets-sold', async (req, res) => {
    try {
        const { eventId } = req.params;

        const ticketsSold = await Ticket.aggregate([
            {
                $match: {
                    event: mongoose.Types.ObjectId(eventId),
                    paymentStatus: 'paid'
                }
            },
            {
                $group: {
                    _id: '$event',
                    totalTicketsSold: { $sum: '$quantity' },
                    totalRevenue: { $sum: '$totalAmount' }
                }
            }
        ]);

        res.json({
            success: true,
            data: ticketsSold[0] || { totalTicketsSold: 0, totalRevenue: 0 }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 8. Kiểm tra vé còn trống cho sự kiện
router.get('/:eventId/availability', async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const ticketsSold = await Ticket.aggregate([
            {
                $match: {
                    event: mongoose.Types.ObjectId(eventId),
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

        res.json({
            success: true,
            data: {
                event: event.title,
                capacity: event.capacity,
                ticketsSold: sold,
                ticketsAvailable: available,
                isAvailable: available > 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 9. Doanh thu theo sự kiện
router.get('/revenue/by-event', protect, authorize('admin'), async (req, res) => {
    try {
        const revenueByEvent = await Ticket.aggregate([
            {
                $match: { paymentStatus: 'paid' }
            },
            {
                $group: {
                    _id: '$event',
                    totalRevenue: { $sum: '$totalAmount' },
                    totalTickets: { $sum: '$quantity' }
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
                    totalRevenue: 1,
                    totalTickets: 1
                }
            },
            {
                $sort: { totalRevenue: -1 }
            }
        ]);

        res.json({
            success: true,
            data: revenueByEvent
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 10. Top sự kiện được đăng ký nhiều nhất
router.get('/top/registered', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const topEvents = await Ticket.aggregate([
            {
                $match: { paymentStatus: 'paid' }
            },
            {
                $group: {
                    _id: '$event',
                    totalRegistrations: { $sum: '$quantity' }
                }
            },
            {
                $sort: { totalRegistrations: -1 }
            },
            {
                $limit: parseInt(limit)
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
                    totalRegistrations: 1,
                    category: '$event.category',
                    date: '$event.dateTime.start'
                }
            }
        ]);

        res.json({
            success: true,
            data: topEvents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 11. Lấy sự kiện trong khoảng thời gian
router.get('/time-range', async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;

        let dateQuery = {};

        if (startDate && endDate) {
            dateQuery['dateTime.start'] = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (startDate) {
            dateQuery['dateTime.start'] = { $gte: new Date(startDate) };
        } else if (endDate) {
            dateQuery['dateTime.start'] = { $lte: new Date(endDate) };
        }

        const events = await Event.find(dateQuery)
            .populate('category', 'name')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort('dateTime.start');

        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 12. Sự kiện có lượt đánh giá cao nhất
router.get('/top/rated', async (req, res) => {
    try {
        const { limit = 10, minReviews = 1 } = req.query;

        const topRatedEvents = await Event.find({
            totalReviews: { $gte: parseInt(minReviews) }
        })
            .sort({ averageRating: -1, totalReviews: -1 })
            .limit(parseInt(limit))
            .populate('category', 'name');

        res.json({
            success: true,
            data: topRatedEvents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 14. Lấy thông tin chi tiết sự kiện cùng ban tổ chức
router.get('/:eventId/details', async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId)
            .populate('category', 'name description');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 15. Lấy danh mục sự kiện và số lượng sự kiện
router.get('/categories/with-count', async (req, res) => {
    try {
        const categoriesWithCount = await Category.aggregate([
            {
                $lookup: {
                    from: 'events',
                    localField: '_id',
                    foreignField: 'category',
                    as: 'events'
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    eventCount: { $size: '$events' },
                    upcomingEvents: {
                        $size: {
                            $filter: {
                                input: '$events',
                                as: 'event',
                                cond: {
                                    $and: [
                                        { $gte: ['$$event.dateTime.start', new Date()] },
                                        { $eq: ['$$event.status', 'upcoming'] }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            {
                $sort: { eventCount: -1 }
            }
        ]);

        res.json({
            success: true,
            data: categoriesWithCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;