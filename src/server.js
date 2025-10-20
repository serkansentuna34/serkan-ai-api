require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const assignmentsRoutes = require('./routes/assignments');
const notesRoutes = require('./routes/notes');
const libraryRoutes = require('./routes/library');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const shortTrainingRoutes = require('./routes/shortTraining');

// Admin routes
const adminClassesRoutes = require('./routes/admin/classes');
const adminUsersRoutes = require('./routes/admin/users');
const adminSystemRoutes = require('./routes/admin/system');
const adminDashboardRoutes = require('./routes/admin/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for nginx
app.set('trust proxy', 1);

// Disable ETags to prevent 304 responses
app.set('etag', false);

// Serve uploaded files with CORS headers - MUST be before helmet
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('uploads'));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - Permissive for multiple concurrent users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 2000 : 5000, // 2000 requests in prod, 5000 in dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing - Increased limit for base64 images in notes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/short-training', shortTrainingRoutes);

// Admin Routes
app.use('/api/admin/classes', adminClassesRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/system', adminSystemRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serkan AI Lab API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
