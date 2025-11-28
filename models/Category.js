// routes/categories.js
const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { protect, authorize } = require('../middleware/auth');

// GET all categories
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find().sort('name');
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

// (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        const category = await Category.create({
            name,
            description
        });

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Category name already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/initialize', protect, authorize('admin'), async (req, res) => {
    try {
        const defaultCategories = [
            { name: 'Technology', description: 'Tech conferences and workshops' },
            { name: 'Music', description: 'Concerts and music festivals' },
            { name: 'Business', description: 'Business conferences and networking' },
            { name: 'Sports', description: 'Sports events and tournaments' },
            { name: 'Education', description: 'Educational workshops and seminars' },
            { name: 'Arts and Culture', description: 'Art exhibitions and cultural events' },
            { name: 'Food and Drink', description: 'Food festivals and culinary events' },
            { name: 'Health and Wellness', description: 'Health, fitness and wellness events' }
        ];

        // Remove existing categories and create new ones
        await Category.deleteMany({});
        const categories = await Category.insertMany(defaultCategories);

        res.json({
            success: true,
            message: 'Default categories initialized',
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;