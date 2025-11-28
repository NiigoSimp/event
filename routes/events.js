// routes/events.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Event = require('../models/Event');
const { protect, authorize } = require('../middleware/auth');

// GET /api/events - Get all events with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, status, search } = req.query;

        let query = {};

        if (category) {
            query.category = category;
        }

        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'location.venue': { $regex: search, $options: 'i' } },
                { 'location.city': { $regex: search, $options: 'i' } }
            ];
        }

        const events = await Event.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort('dateTime.start');

        const totalEvents = await Event.countDocuments(query);

        res.json({
            success: true,
            count: events.length,
            total: totalEvents,
            data: events,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalEvents / limit)
            }
        });
    } catch (error) {
        console.error(' GET ALL EVENTS ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST /api/events - Create new event (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        console.log('=== EVENT CREATION STARTED ===');
        console.log('Request body:', req.body);

        const {
            title,
            description,
            category,
            venue,
            city,
            country,
            startDate,
            endDate,
            organizerName,
            organizerEmail,
            organizerPhone,
            capacity,
            ticketPrice
        } = req.body;

        // Validation
        if (!title || !description || !category || !venue || !city || !country ||
            !startDate || !endDate || !organizerName || !organizerEmail || !organizerPhone ||
            !capacity || !ticketPrice) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Create event with proper nested structure
        const eventData = {
            title,
            description,
            category,
            location: {
                venue,
                city,
                country
            },
            dateTime: {
                start: new Date(startDate),
                end: new Date(endDate)
            },
            organizer: {
                name: organizerName,
                email: organizerEmail,
                phone: organizerPhone
            },
            capacity: parseInt(capacity),
            ticketPrice: parseFloat(ticketPrice)
        };

        console.log('Processed event data:', eventData);

        const event = await Event.create(eventData);

        console.log('Event saved successfully:', event._id);
        console.log('=== EVENT CREATION COMPLETED ===');

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: event
        });
    } catch (error) {
        console.error('CREATE EVENT ERROR:', error);
        res.status(400).json({
            success: false,
            message: error.message,
            details: error.errors
        });
    }
});

// GET /api/events/:id - Get single event by ID
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

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
        console.error('GET EVENT BY ID ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// PUT /api/events/:id - Update event (Admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.json({
            success: true,
            message: 'Event updated successfully',
            data: event
        });
    } catch (error) {
        console.error('UPDATE EVENT ERROR:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// DELETE /api/events/:id - Delete event (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('DELETE EVENT ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/upcoming - Get upcoming events
router.get('/upcoming', async (req, res) => {
    try {
        console.log('Fetching upcoming events...');
        const events = await Event.find({
            'dateTime.start': { $gte: new Date() },
            status: 'upcoming'
        })
            .sort('dateTime.start')
            .limit(50);

        console.log(`Found ${events.length} upcoming events`);

        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        console.error('UPCOMING EVENTS ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/search - Search events by category and location
router.get('/search', async (req, res) => {
    try {
        console.log('Searching events...', req.query);
        const { category, location, page = 1, limit = 10 } = req.query;

        let query = {};

        if (category) {
            query.category = { $regex: category, $options: 'i' };
        }

        if (location) {
            query.$or = [
                { 'location.venue': { $regex: location, $options: 'i' } },
                { 'location.city': { $regex: location, $options: 'i' } },
                { 'location.country': { $regex: location, $options: 'i' } }
            ];
        }

        const events = await Event.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort('dateTime.start');

        console.log(`Found ${events.length} events for search`);

        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        console.error('SEARCH EVENTS ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/count-by-status - Count events by status (Admin only)
router.get('/count-by-status', protect, authorize('admin'), async (req, res) => {
    try {
        console.log('Counting events by status...');
        const statusCount = await Event.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log('Status count result:', statusCount);

        res.json({
            success: true,
            data: statusCount
        });
    } catch (error) {
        console.error('COUNT BY STATUS ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/:eventId/availability - Check ticket availability
router.get('/:eventId/availability', async (req, res) => {
    try {
        const { eventId } = req.params;
        console.log('Checking availability for event:', eventId);

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const Ticket = require('../models/Ticket');
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

        console.log(`Event ${eventId} - Capacity: ${event.capacity}, Sold: ${sold}, Available: ${available}`);

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
        console.error('AVAILABILITY CHECK ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/top/registered - Top registered events
router.get('/top/registered', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        console.log('Fetching top registered events, limit:', limit);

        const Ticket = require('../models/Ticket');
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

        console.log(`Found ${topEvents.length} top registered events`);

        res.json({
            success: true,
            data: topEvents
        });
    } catch (error) {
        console.error('TOP REGISTERED EVENTS ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/time-range - Events in time range
router.get('/time-range', async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;
        console.log('Fetching events in time range:', { startDate, endDate });

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
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort('dateTime.start');

        console.log(`Found ${events.length} events in time range`);

        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        console.error('TIME RANGE EVENTS ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/top/rated - Top rated events
router.get('/top/rated', async (req, res) => {
    try {
        const { limit = 10, minReviews = 1 } = req.query;
        console.log('Fetching top rated events:', { limit, minReviews });

        const topRatedEvents = await Event.find({
            totalReviews: { $gte: parseInt(minReviews) }
        })
            .sort({ averageRating: -1, totalReviews: -1 })
            .limit(parseInt(limit));

        console.log(`Found ${topRatedEvents.length} top rated events`);

        res.json({
            success: true,
            data: topRatedEvents
        });
    } catch (error) {
        console.error('TOP RATED EVENTS ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/categories - Get all categories
router.get('/categories', async (req, res) => {
    try {
        console.log('Fetching categories...');
        const categories = await Event.distinct('category');

        console.log(`Found ${categories.length} categories:`, categories);

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('CATEGORIES ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/events/categories/with-count - Categories with event count
router.get('/categories/with-count', async (req, res) => {
    try {
        console.log('Fetching categories with count...');
        const categoriesWithCount = await Event.aggregate([
            {
                $group: {
                    _id: '$category',
                    eventCount: { $sum: 1 },
                    upcomingEvents: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$dateTime.start', new Date()] },
                                        { $eq: ['$status', 'upcoming'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    name: '$_id',
                    eventCount: 1,
                    upcomingEvents: 1
                }
            },
            {
                $sort: { eventCount: -1 }
            }
        ]);

        console.log('Categories with count result:', categoriesWithCount);

        res.json({
            success: true,
            data: categoriesWithCount
        });
    } catch (error) {
        console.error('CATEGORIES WITH COUNT ERROR:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;