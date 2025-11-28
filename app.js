// app.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/tickets', require('./routes/tickets')); // ADD THIS LINE

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
            tickets: '/api/tickets' // ADD THIS LINE
        }
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/api/tickets', require('./routes/tickets'));
module.exports = app;