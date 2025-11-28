// routes/events.js
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// POST /api/events - Create new event
router.post('/', async (req, res) => {
    try {
        console.log('Request body:', req.body); // Debug log

        // Validate required fields
        const { title, description, category, location, dateTime, organizer, capacity, ticketPrice } = req.body;

        if (!title || !description || !category || !location || !dateTime || !organizer || !capacity || !ticketPrice) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        const event = new Event(req.body);
        const savedEvent = await event.save();

        console.log('Event saved successfully:', savedEvent._id); // Debug log
        res.status(201).json(savedEvent);

    } catch (error) {
        console.error('Error saving event:', error);
        res.status(400).json({
            error: error.message,
            details: error.errors
        });
    }
});

module.exports = router;