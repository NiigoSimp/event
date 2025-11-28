const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Zmz:ILoveZmz@cluster0.qzzflwg.mongodb.net/event-management-DB?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('MongoDB Connected Successfully');
        initializeAdmin();
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Models - SINGLE SCHEMA DEFINITIONS
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    phone: String,
    createdAt: { type: Date, default: Date.now }
});

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
        type: String,
        required: true
    },
    location: {
        venue: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
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
        email: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
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
    averageRating: {
        type: Number,
        default: 0
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

const ticketSchema = new mongoose.Schema({
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ticketNumber: { type: String, unique: true, required: true },
    quantity: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true },
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
    bookedAt: { type: Date, default: Date.now },
    qrCode: String
});

const User = mongoose.model('User', userSchema);
const Event = mongoose.model('Event', eventSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);

// Initialize Admin Account
async function initializeAdmin() {
    try {
        const adminEmail = 'thehollow2008@gmail.com';
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('NiigoS1tg', 12);
            await User.create({
                name: 'System Administrator',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                phone: '+1234567890'
            });
            console.log('Admin account created successfully!');
        } else {
            console.log('Admin account already exists');
        }
    } catch (error) {
        console.error('Error initializing admin:', error.message);
    }
}

// Auth Middleware
const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};


app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'user',
            phone
        });

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            token,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


app.post('/api/tickets/purchase', protect, async (req, res) => {
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

// Get user's purchased tickets
app.get('/api/tickets/my-tickets', protect, async (req, res) => {
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
app.get('/api/tickets/:ticketId', protect, async (req, res) => {
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
app.post('/api/tickets/:ticketId/cancel', protect, async (req, res) => {
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


app.get('/api/events', async (req, res) => {
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.post('/api/events', protect, authorize('admin'), async (req, res) => {
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
        console.error('Error saving event:', error);
        res.status(400).json({
            success: false,
            message: error.message,
            details: error.errors
        });
    }
});

app.get('/api/events/:id', async (req, res) => {
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update event
app.put('/api/events/:id', protect, authorize('admin'), async (req, res) => {
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
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Delete event
app.delete('/api/events/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Also delete associated tickets
        await Ticket.deleteMany({ event: req.params.id });

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==================== 15 REQUIRED FUNCTIONS ====================

// 1. Get upcoming events
app.get('/api/events/upcoming', async (req, res) => {
    try {
        const events = await Event.find({
            'dateTime.start': { $gte: new Date() },
            status: 'upcoming'
        })
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

// 2. Search events by category and location
app.get('/api/events/search', async (req, res) => {
    try {
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

// 3. Count events by status
app.get('/api/events/count-by-status', protect, authorize('admin'), async (req, res) => {
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

// 4. Get user profile with ticket stats
app.get('/api/users/:userId/profile', protect, async (req, res) => {
    try {
        const { userId } = req.params;

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
                $match: { user: new mongoose.Types.ObjectId(userId) }
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

// 5. Search users by email
app.get('/api/users/search/by-email', protect, authorize('admin'), async (req, res) => {
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

// 6. Get tickets sold for an event
app.get('/api/events/:eventId/tickets-sold', async (req, res) => {
    try {
        const { eventId } = req.params;

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

// 7. Get user booking history
app.get('/api/users/:userId/booking-history', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

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

// 8. Check event availability
app.get('/api/events/:eventId/availability', async (req, res) => {
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

// 9. Revenue by event
app.get('/api/events/revenue/by-event', protect, authorize('admin'), async (req, res) => {
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

// 10. Top registered events
app.get('/api/events/top/registered', async (req, res) => {
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

// 11. Events in time range
app.get('/api/events/time-range', async (req, res) => {
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

// 12. Top rated events
app.get('/api/events/top/rated', async (req, res) => {
    try {
        const { limit = 10, minReviews = 1 } = req.query;

        const topRatedEvents = await Event.find({
            totalReviews: { $gte: parseInt(minReviews) }
        })
            .sort({ averageRating: -1, totalReviews: -1 })
            .limit(parseInt(limit));

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

// 13. Payment summary by event
app.get('/api/admin/payment-summary/by-event', protect, authorize('admin'), async (req, res) => {
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

// 14. Get event details
app.get('/api/events/:eventId/details', async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId);
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

// 15. Categories with count
app.get('/api/events/categories/with-count', async (req, res) => {
    try {
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

// Additional utility routes
app.get('/api/events/categories', async (req, res) => {
    try {
        const categories = await Event.distinct('category');
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Admin Dashboard
app.get('/api/admin/dashboard', protect, authorize('admin'), async (req, res) => {
    try {
        const [
            totalUsers,
            totalEvents,
            totalTickets,
            totalRevenue,
            eventsByStatus,
            eventsByCategory
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
            Event.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ])
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
                eventsByCategory
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// API Home
app.get('/api', (req, res) => {
    res.json({
        message: 'Event Management API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            events: '/api/events',
            users: '/api/users',
            admin: '/api/admin',
            tickets: '/api/tickets'
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Export for Vercel
module.exports = app;