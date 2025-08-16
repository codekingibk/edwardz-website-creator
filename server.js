require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/edwards-creator', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// User Schema
const UserSchema = new mongoose.Schema({
    userId: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    coins: { type: Number, default: 100 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Admin settings schema
const AdminSettingsSchema = new mongoose.Schema({
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: '' },
    lastBroadcast: { type: String, default: '' }
});

const AdminSettings = mongoose.model('AdminSettings', AdminSettingsSchema);

// Generate unique ID
function generateUserId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Create admin user if not exists
async function createAdminUser() {
    const adminExists = await User.findOne({ username: 'Adegboyega' });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('ibukun', 10);
        await User.create({
            userId: generateUserId(),
            username: 'Adegboyega',
            email: 'admin@edwards.com',
            password: hashedPassword,
            coins: 999999,
            role: 'admin'
        });
        console.log('Admin user created');
    }
}

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    next();
}

// Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = await User.create({
            userId: generateUserId(),
            username,
            email,
            password: hashedPassword,
            coins: 100 // Starting coins
        });
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Check account status
        if (user.status !== 'active') {
            return res.status(403).json({ message: `Account is ${user.status}` });
        }
        
        // Create JWT
        const token = jwt.sign(
            { userId: user.userId, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token,
            user: {
                userId: user.userId,
                username: user.username,
                email: user.email,
                coins: user.coins,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.user.userId });
        if (!user) {
            return res.sendStatus(404);
        }
        
        res.json({
            userId: user.userId,
            username: user.username,
            email: user.email,
            coins: user.coins,
            role: user.role
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.sendStatus(500);
    }
});

app.post('/api/user/deduct-coins', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findOne({ userId: req.user.userId });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.coins < amount) {
            return res.status(400).json({ message: 'Insufficient coins' });
        }
        
        user.coins -= amount;
        await user.save();
        
        res.json({ 
            newBalance: user.coins,
            message: `Deducted ${amount}€ coins successfully`
        });
    } catch (error) {
        console.error('Deduct coins error:', error);
        res.status(500).json({ message: 'Server error during coin deduction' });
    }
});

// Admin routes
app.get('/api/admin/users', authenticateToken, adminOnly, async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 });
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

app.patch('/api/admin/users/:userId', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        
        const user = await User.findOneAndUpdate(
            { userId },
            updates,
            { new: true, projection: { password: 0 } }
        );
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error updating user' });
    }
});

app.post('/api/admin/broadcast', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { message } = req.body;
        
        // In a real app, you would send this to all connected clients
        // For now, we'll just save it
        await AdminSettings.findOneAndUpdate(
            {},
            { lastBroadcast: message },
            { upsert: true }
        );
        
        res.json({ message: 'Broadcast sent successfully' });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ message: 'Server error sending broadcast' });
    }
});

app.post('/api/admin/maintenance', authenticateToken, adminOnly, async (req, res) => {
    try {
        const { message } = req.body;
        const enable = !!message;
        
        await AdminSettings.findOneAndUpdate(
            {},
            { 
                maintenanceMode: enable,
                maintenanceMessage: enable ? message : ''
            },
            { upsert: true }
        );
        
        res.json({ 
            message: `Maintenance mode ${enable ? 'enabled' : 'disabled'}`,
            maintenanceMode: enable
        });
    } catch (error) {
        console.error('Maintenance error:', error);
        res.status(500).json({ message: 'Server error toggling maintenance' });
    }
});

// Check maintenance mode
app.get('/api/maintenance', async (req, res) => {
    try {
        const settings = await AdminSettings.findOne({});
        res.json({
            maintenanceMode: settings?.maintenanceMode || false,
            message: settings?.maintenanceMessage || ''
        });
    } catch (error) {
        console.error('Maintenance check error:', error);
        res.status(500).json({ message: 'Server error checking maintenance' });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
    await createAdminUser();
    
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
