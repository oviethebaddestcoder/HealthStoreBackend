import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { supabaseAdmin } from './config/supabase.js';
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

// Paystack webhook - BEFORE express.json()
app.post('/api/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
    const signature = req.headers['x-paystack-signature'];

    console.log('📥 Webhook received from Paystack');

    if (hash !== signature) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body);
    console.log('📋 Webhook event:', event.event);

    if (event.event === 'charge.success') {
      const { reference, status, metadata } = event.data;
      
      console.log('✅ Payment successful:', {
        reference,
        status,
        order_id: metadata?.order_id
      });

      if (metadata?.order_id && metadata?.user_id) {
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
          .from('orders')
          .update({ 
            payment_status: 'success',
            payment_reference: reference
          })
          .eq('id', metadata.order_id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Failed to update order:', updateError);
          return res.status(500).json({ error: 'Failed to update order' });
        }

        console.log('✅ Order updated:', updatedOrder.id);

        const { error: cartError } = await supabaseAdmin
          .from('cart')
          .delete()
          .eq('user_id', metadata.user_id);

        if (cartError) {
          console.error('⚠️ Failed to clear cart:', cartError);
        } else {
          console.log('🛒 Cart cleared for user:', metadata.user_id);
        }

        return res.json({ 
          received: true, 
          message: 'Payment processed successfully' 
        });
      }
    }

    if (event.event === 'charge.failed') {
      const { reference, metadata } = event.data;
      
      console.log('❌ Payment failed:', {
        reference,
        order_id: metadata?.order_id
      });

      if (metadata?.order_id) {
        await supabaseAdmin
          .from('orders')
          .update({ 
            payment_status: 'failed',
            payment_reference: reference
          })
          .eq('id', metadata.order_id);

        console.log('📝 Order marked as failed:', metadata.order_id);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Regular JSON middleware
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/paystack', paystackRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Healthcare E-commerce API is running',
    timestamp: new Date().toISOString()
  });
});

// Webhook test endpoint
app.get('/api/paystack/webhook/test', (req, res) => {
  res.json({
    status: 'Webhook endpoint is active',
    url: '/api/paystack/webhook',
    method: 'POST',
    note: 'Configure this URL in your Paystack dashboard'
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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🏥 Healthcare E-commerce Backend API`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔔 Webhook URL: http://localhost:${PORT}/api/paystack/webhook`);
  console.log(`🔐 Google OAuth: http://localhost:${PORT}/api/auth/google`);
});