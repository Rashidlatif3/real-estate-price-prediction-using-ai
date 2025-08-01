const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

const app = express();

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ai-real-estate-portal', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
    secret: 'your-secret-key', // Change this to a strong secret in production
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/ai-real-estate-portal' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Multer setup for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Import models
const Property = require('./models/Property');
const Advertisement = require('./models/Advertisement');
const User = require('./models/User');

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth configuration
passport.use(new GoogleStrategy({
    clientID: 'YOUR_GOOGLE_CLIENT_ID',
    clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
    callbackURL: '/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
            });
            await user.save();
        }
        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Middleware to make user available in templates
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
});

// AI price prediction function replaced by Flask API call
async function predictPrice(data) {
    try {
        const response = await axios.post('http://localhost:5000/predict', data);
        return response.data.predicted_price;
    } catch (error) {
        console.error('Error calling prediction API:', error.message);
        // Fallback to simple rule-based prediction
        return data.size * 1000 + data.rooms * 50000;
    }
}

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// Registration form
app.get('/register', (req, res) => {
    res.render('register', { errors: [], data: {} });
});

// Handle registration
app.post('/register', [
    check('email').isEmail().withMessage('Enter a valid email address'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    check('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('register', { errors: errors.array(), data: req.body });
    }
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('register', { errors: [{ msg: 'Email already registered' }], data: req.body });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        req.session.userId = user._id;
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Login form
app.get('/login', (req, res) => {
    res.render('login', { errors: [], data: {} });
});

// Handle login
app.post('/login', [
    check('email').isEmail().withMessage('Enter a valid email address'),
    check('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('login', { errors: errors.array(), data: req.body });
    }
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('login', { errors: [{ msg: 'Invalid email or password' }], data: req.body });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { errors: [{ msg: 'Invalid email or password' }], data: req.body });
        }
        req.session.userId = user._id;
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Server Error');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Test POST endpoint to verify integration with Python API
app.post('/test-predict', async (req, res) => {
    try {
        const data = req.body;
        const predictedPrice = await predictPrice(data);
        res.json({ predictedPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /predict-price endpoint for frontend price prediction requests
app.post('/predict-price', async (req, res) => {
    try {
        const data = req.body;
        const predictedPrice = await predictPrice(data);
        res.json({ predictedPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Home - list properties with search/filter
app.get('/', async (req, res) => {
    const { location, type, minPrice, maxPrice } = req.query;
    let filter = {};

    if (location) {
        filter.location = new RegExp(location, 'i');
    }
    if (type) {
        filter.type = type;
    }
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    try {
        const properties = await Property.find(filter).lean();
        for (const p of properties) {
            const data = {
                size: p.size,
                rooms: p.rooms,
                location: p.location
            };
            p.predictedPrice = await predictPrice(data);
            p.priceDiff = Math.abs(p.price - p.predictedPrice);
            p.priceDiffPercent = (p.priceDiff / p.predictedPrice) * 100;
        }
        res.render('index', { properties, filters: req.query });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Add property form
app.get('/properties/new', (req, res) => {
    res.render('new');
});

// Create property
app.post('/properties', upload.single('image'), async (req, res) => {
    try {
        const { location, size, rooms, price, type } = req.body;
        const image = req.file ? '/uploads/' + req.file.filename : null;

        const property = new Property({
            location,
            size: Number(size),
            rooms: Number(rooms),
            price: Number(price),
            type,
            image,
        });

        await property.save();
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Edit property form
app.get('/properties/:id/edit', async (req, res) => {
    try {
        const property = await Property.findById(req.params.id).lean();
        if (!property) {
            return res.status(404).send('Property not found');
        }
        res.render('edit', { property });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Update property
app.post('/properties/:id', upload.single('image'), async (req, res) => {
    try {
        const { location, size, rooms, price, type } = req.body;
        const updateData = {
            location,
            size: Number(size),
            rooms: Number(rooms),
            price: Number(price),
            type,
        };
        if (req.file) {
            updateData.image = '/uploads/' + req.file.filename;
        }

        await Property.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete property
app.post('/properties/:id/delete', async (req, res) => {
    try {
        await Property.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Dashboard
app.get('/dashboard', async (req, res) => {
    try {
        const properties = await Property.find().lean();
        for (const p of properties) {
            const data = {
                size: p.size,
                rooms: p.rooms,
                location: p.location
            };
            p.predictedPrice = await predictPrice(data);
            p.priceDiff = Math.abs(p.price - p.predictedPrice);
            p.priceDiffPercent = p.predictedPrice !== 0 ? (p.priceDiff / p.predictedPrice) * 100 : 0;
            p.isPriceOff = p.priceDiffPercent > 20; // highlight if price differs more than 20%
        }
        res.render('dashboard', { properties, user: req.user });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Advertisement routes

// List advertisements
app.get('/advertisements', async (req, res) => {
    try {
        const ads = await Advertisement.find().lean();
        res.render('advertisements', { ads });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Show add advertisement form
app.get('/advertisements/new', (req, res) => {
    res.render('add_advertisement');
});

// Handle advertisement image upload and save
app.post('/advertisements', upload.array('images', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).send('No images uploaded');
        }

        const adsToInsert = files.map(file => ({
            image: '/uploads/' + file.filename,
        }));

        await Advertisement.insertMany(adsToInsert);
        res.redirect('/advertisements');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Delete advertisement
app.post('/advertisements/:id/delete', async (req, res) => {
    try {
        await Advertisement.findByIdAndDelete(req.params.id);
        res.redirect('/advertisements');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Start server
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});