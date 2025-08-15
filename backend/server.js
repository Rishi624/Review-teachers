require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- USER Schema and Model ---
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: /^[a-zA-Z0-9._%+-]+@student\.gitam\.edu$/
    },
    password: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String,
        default: null
    },
    verificationCodeExpires: {
        type: Date,
        default: null
    }
});

const User = mongoose.model('User', userSchema);

// --- Contribution Schema and Model ---
const contributionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    facultyName: {
        type: String,
        required: true
    },
    facultyEmail: {
        type: String,
        required: true,
        lowercase: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        required: true,
        maxlength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Contribution = mongoose.model('Contribution', contributionSchema);

const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token required.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err);
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// --- All Frontend-facing Routes ---

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    const gitamEmailRegex = /^[a-zA-Z0-9._%+-]+@student\.gitam\.edu$/;
    if (!gitamEmailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format. Only @student.gitam.edu emails are allowed.' });
    }
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (!existingUser.isVerified) {
                const verificationCode = generateVerificationCode();
                const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
                existingUser.verificationCode = verificationCode;
                existingUser.verificationCodeExpires = verificationCodeExpires;
                await existingUser.save();
                const msg = {
                    to: email, from: process.env.SENDER_EMAIL, subject: 'Gitam Student Portal: Verify Your Email',
                    html: `<p>Hello,</p><p>Thank you for registering. Your 6-digit verification code is:</p><h3>${verificationCode}</h3><p>This code will expire in 10 minutes.</p><p>If you did not request this, please ignore this email.</p>`,
                };
                await sgMail.send(msg);
                return res.status(200).json({ message: 'User already exists but not verified. A new verification code has been sent to your email.' });
            } else {
                return res.status(409).json({ message: 'User with this email already exists and is verified.' });
            }
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const verificationCode = generateVerificationCode();
        const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        const newUser = new User({
            name, email, password: hashedPassword, verificationCode, verificationCodeExpires, isVerified: false
        });
        await newUser.save();
        const msg = {
            to: email, from: process.env.SENDER_EMAIL, subject: 'Gitam Student Portal: Verify Your Email',
            html: `<p>Hello,</p><p>Thank you for registering. Your 6-digit verification code is:</p><h3>${verificationCode}</h3><p>This code will expire in 10 minutes.</p><p>If you did not request this, please ignore this email.</p>`,
        };
        await sgMail.send(msg);
        res.status(201).json({ message: 'Registration successful! A verification code has been sent to your email. Please check your inbox.' });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

app.post('/verify-email', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ message: 'Email and verification code are required.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.isVerified) {
            return res.status(200).json({ message: 'Email is already verified.' });
        }
        if (user.verificationCode !== code) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }
        if (user.verificationCodeExpires < new Date()) {
            user.verificationCode = null; user.verificationCodeExpires = null; await user.save();
            return res.status(400).json({ message: 'Verification code has expired. Please register again to get a new code.' });
        }
        user.isVerified = true; user.verificationCode = null; user.verificationCodeExpires = null; await user.save();
        res.status(200).json({ message: 'Email successfully verified!' });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'Server error during email verification.' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        if (!user.isVerified) {
            if (!user.verificationCode || user.verificationCodeExpires < new Date()) {
                const verificationCode = generateVerificationCode();
                const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
                user.verificationCode = verificationCode; user.verificationCodeExpires = verificationCodeExpires; await user.save();
                const msg = {
                    to: email, from: process.env.SENDER_EMAIL, subject: 'Gitam Student Portal: New Verification Code',
                    html: `<p>Hello,</p><p>You tried to log in but your email is not verified. Your new 6-digit verification code is:</p><h3>${verificationCode}</h3><p>This code will expire in 10 minutes.</p>`,
                };
                await sgMail.send(msg);
                return res.status(403).json({ message: 'Please verify your email address before logging in. A new verification code has been sent to your email.' });
            } else {
                return res.status(403).json({ message: 'Please verify your email address before logging in.' });
            }
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.status(200).json({
            message: 'Login successful!',
            token: token,
            user: { email: user.email, name: user.name }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

app.get('/dashboard', authenticateToken, (req, res) => {
    res.status(200).json({
        message: `Welcome to your dashboard, ${req.user.name}!`,
        user: { email: req.user.email, name: req.user.name }
    });
});

app.get('/api/contributions/me', authenticateToken, async (req, res) => {
    try {
        const contributions = await Contribution.find({ user: req.user.id }).populate('user', 'name');
        res.status(200).json(contributions);
    } catch (error) {
        console.error('Error fetching contributions:', error);
        res.status(500).json({ message: 'Server error fetching contributions.' });
    }
});

app.post('/api/contributions', authenticateToken, async (req, res) => {
    const { facultyName, facultyEmail, rating, review } = req.body;
    if (!facultyName || !facultyEmail || !rating || !review) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    const existingReview = await Contribution.findOne({
        user: req.user.id,
        facultyEmail: facultyEmail
    });
    if (existingReview) {
        return res.status(409).json({ message: 'You have already submitted a review for this teacher.' });
    }
    const wordCount = review.trim().split(/\s+/).length;
    if (wordCount > 100) {
        return res.status(400).json({ message: 'Review must be 100 words or less.' });
    }
    const abusiveWords = ['abuse', 'abusive', 'harmful', 'offensive'];
    const containsAbuse = abusiveWords.some(word => review.toLowerCase().includes(word));
    if (containsAbuse) {
        return res.status(400).json({ message: 'Your review contains abusive words. It cannot be submitted.' });
    }
    try {
        const newContribution = new Contribution({
            user: req.user.id, facultyName, facultyEmail, rating, review
        });
        await newContribution.save();
        res.status(201).json({ message: 'Contribution submitted successfully!' });
    } catch (error) {
        console.error('Error submitting contribution:', error);
        res.status(500).json({ message: 'Server error submitting contribution.' });
    }
});

app.delete('/api/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await Contribution.deleteMany({ user: userId });
        await User.findByIdAndDelete(userId);
        res.status(200).json({ message: 'Your account and all contributions have been permanently deleted.' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ message: 'Server error deleting account.' });
    }
});

app.get('/api/contributions/search', async (req, res) => {
    const { query } = req.query;
    let contributions;

    try {
        if (!query) {
            contributions = await Contribution.find().populate('user', 'name');
        } else {
            contributions = await Contribution.find({
                $or: [
                    { facultyEmail: { $regex: query, $options: 'i' } },
                    { facultyName: { $regex: query, $options: 'i' } }
                ]
            }).populate('user', 'name');
        }

        if (contributions.length === 0) {
            return res.status(404).json({ message: 'No contributions found.' });
        }

        if (!query) {
            const allReviews = contributions.map(contrib => ({
                facultyName: contrib.facultyName,
                facultyEmail: contrib.facultyEmail,
                reviewerName: contrib.user.name,
                rating: contrib.rating,
                review: contrib.review,
                createdAt: contrib.createdAt
            }));
            return res.status(200).json({ allReviews });
        } else {
            const totalRating = contributions.reduce((sum, contrib) => sum + contrib.rating, 0);
            const averageRating = (totalRating / contributions.length).toFixed(1);

            const facultyName = contributions[0].facultyName;
            const facultyEmail = contributions[0].facultyEmail;
            const reviews = contributions.map(contrib => ({
                reviewerName: contrib.user.name,
                rating: contrib.rating,
                review: contrib.review,
                createdAt: contrib.createdAt
            }));
            return res.status(200).json({
                facultyName,
                facultyEmail,
                averageRating,
                reviews
            });
        }
    } catch (error) {
        console.error('Error searching for contributions:', error);
        res.status(500).json({ message: 'Server error during search.' });
    }
});

// NEW API ROUTE: Admin password gate
app.post('/api/admin/auth', async (req, res) => {
    const { adminPassword } = req.body;
    if (adminPassword === process.env.ADMIN_PASSWORD) {
        return res.status(200).json({ message: 'Admin authentication successful.' });
    }
    return res.status(403).json({ message: 'Incorrect admin password.' });
});

// NEW API ROUTE: Admin deletion of users and contributions (with rate-limiting)
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/admin/delete', adminLimiter, async (req, res) => {
    const { adminPassword, userEmailToDelete, contributionIdToDelete } = req.body;

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ message: 'Incorrect admin password.' });
    }

    try {
        if (userEmailToDelete) {
            const user = await User.findOne({ email: userEmailToDelete });
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }
            
            await Contribution.deleteMany({ user: user._id });
            await User.findByIdAndDelete(user._id);
            
            return res.status(200).json({ message: `User ${userEmailToDelete} and all their contributions have been deleted.` });
        }

        if (contributionIdToDelete) {
            const contribution = await Contribution.findById(contributionIdToDelete);
            if (!contribution) {
                return res.status(404).json({ message: 'Contribution not found.' });
            }
            
            await Contribution.findByIdAndDelete(contributionIdToDelete);
            
            return res.status(200).json({ message: `Contribution with ID ${contributionIdToDelete} has been deleted.` });
        }

        return res.status(400).json({ message: 'Please provide either a user email or a contribution ID to delete.' });

    } catch (error) {
        console.error('Admin deletion error:', error);
        return res.status(500).json({ message: 'Server error during admin deletion.' });
    }
});

app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});