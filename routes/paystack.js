import express from 'express';
import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize Paystack payment
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    const { order_id, email, amount } = req.body;

    if (!order_id || !email || !amount) {
      return res.status(400).json({ 
        error: 'Order ID, email, and amount are required' 
      });
    }

    // Verify order exists and belongs to user
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', req.user.id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Initialize Paystack transaction
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        reference: `order_${order_id}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/verify-payment`,
        metadata: {
          order_id,
          user_id: req.user.id,
          custom_fields: [
            {
              display_name: "Order ID",
              variable_name: "order_id",
              value: order_id
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { data } = response.data;

    // Update order with payment reference
    await supabaseAdmin
      .from('orders')
      .update({ 
        payment_reference: data.reference 
      })
      .eq('id', order_id);

    res.json({
      message: 'Payment initialized successfully',
      authorization_url: data.authorization_url,
      access_code: data.access_code,
      reference: data.reference
    });
  } catch (error) {
    console.error('Initialize payment error:', error);
    
    if (error.response?.data) {
      return res.status(400).json({ 
        error: 'Payment initialization failed',
        details: error.response.data 
      });
    }
    
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

// Verify payment manually
router.get('/verify/:reference', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const { data } = response.data;

    if (data.status === 'success') {
      // Update order status
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'success'
        })
        .eq('payment_reference', reference);

      if (error) {
        throw error;
      }

      // Clear user cart
      await supabaseAdmin
        .from('cart')
        .delete()
        .eq('user_id', req.user.id);

      res.json({
        status: 'success',
        message: 'Payment verified successfully',
        order_id: data.metadata.order_id
      });
    } else {
      res.status(400).json({
        status: 'failed',
        message: 'Payment verification failed',
        gateway_response: data.gateway_response
      });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

export default router;
