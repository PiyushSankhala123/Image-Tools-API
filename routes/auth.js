const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Image = require('../models/Image');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try 
    {
        let user = await User.findOne({ email });
        if (user) 
        {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        user = new User({ username, email, password });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        const payload = { id: user.id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ success: true, token });

    } 
    catch (err) 
    {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try 
    {
        let user = await User.findOne({ email }).select('+password');
        if (!user) 
        {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) 
        {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const payload = { id: user.id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ success: true, token });

    } catch (err) 
    {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.get('/profile', protect, async (req, res) => {
    try 
    {
        const user = await User.findById(req.user.id);
        const images = await Image.find({ user: req.user.id }).sort({ uploadDate: -1 });
        res.json({ success: true, user, images });
    } 
    catch (err) 
    {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
