// server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import dotenv from 'dotenv';
import passport from './config/passport.js';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import paystackRoutes from './routes/paystack.js';

dotenv.config();

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});

// Middleware
app.use(helmet());
app.use(limiter);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// IMPORTANT: Paystack webhook route MUST be before express.json()
// This is because webhooks need raw body for signature verification
app.use('/api/paystack', paystackRoutes);

// Regular JSON middleware - AFTER webhook route
app.use(express.json({ limit: '10mb' }));

// All other routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Health Excellence API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/paystack/webhook`,
      verify: '/api/paystack/verify',
      status: '/api/paystack/status/:reference'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`


    
  🌿 Health Excellence E-commerce API                        
🚀 Server running on port ${PORT}                              
   📍 Health check: http://localhost:${PORT}/api/health          
        
💳 Payment Endpoints:                                       
      🔔 Webhook: http://localhost:${PORT}/api/paystack/webhook    
   ✅ Verify: POST /api/paystack/verify                   

   📊 Status: GET /api/paystack/status/:reference             
   🔐 OAuth: http://localhost:${PORT}/api/auth/google        
  `);
  
  console.log('⚙️  Configuration:');
  console.log(`   - Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   - Paystack: ${process.env.PAYSTACK_SECRET_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Configure webhook URL in Paystack dashboard');
  console.log('   2. Enable events: charge.success, charge.failed');
  console.log('   3. Test webhook: GET /api/paystack/webhook/test');
  console.log('');
});