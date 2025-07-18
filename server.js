require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
const connectDB = require('./config/database');
const certificateRoutes = require('./routes/certificates');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 12001;

// SSL certificate options
// const options = {
//   key: fs.readFileSync(path.join(__dirname, 'server.key')),
//   cert: fs.readFileSync(path.join(__dirname, 'server.crt')),
// };

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Certificate Management API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', certificateRoutes);

// Serve uploaded files statically (for development)
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Start HTTPS server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Certificate Management API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`📁 Static files: http://localhost:${PORT}/uploads`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;