// routes/paystack.js - Simplified Payment Routes
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';


const router = express.Router();

/**
 * Webhook handler - PRIMARY payment verification method
 * This is called automatically by Paystack when payment status changes
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
    const signature = req.headers['x-paystack-signature'];

    console.log('📥 Paystack webhook received');

    if (hash !== signature) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body);
    console.log('📋 Event type:', event.event);

    // Handle successful payment
    if (event.event === 'charge.success') {
      const { reference, status, metadata, amount } = event.data;

      console.log('✅ Payment successful:', {
        reference,
        order_id: metadata?.order_id,
        amount: amount / 100
      });

      if (metadata?.order_id && metadata?.user_id) {
        // Get order details
        const { data: order, error: orderError } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('id', metadata.order_id)
          .single();

        if (orderError) {
          console.error('❌ Order not found:', orderError);
          return res.status(404).json({ error: 'Order not found' });
        }

        // Update order status
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'success',
            order_status: 'processing',
            payment_reference: reference
          })
          .eq('id', metadata.order_id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Failed to update order:', updateError);
          return res.status(500).json({ error: 'Failed to update order' });
        }

        console.log('✅ Order updated successfully:', updatedOrder.id);

        // Clear user's cart
        const { error: cartError } = await supabaseAdmin
          .from('cart')
          .delete()
          .eq('user_id', metadata.user_id);

        if (cartError) {
          console.error('⚠️ Failed to clear cart:', cartError);
        } else {
          console.log('🛒 Cart cleared for user:', metadata.user_id);
        }
        // Fetch order items from JSON field in the order record
        if (order.order_items && Array.isArray(order.order_items)) {
          for (const item of order.order_items) {
            const { error: stockError } = await supabaseAdmin.rpc('decrement_stock', {
              product_id: item.product_id,
              quantity: item.quantity
            });

            if (stockError) {
              console.error(`⚠️ Failed to decrement stock for ${item.product_id}:`, stockError);
            } else {
              console.log(`✅ Stock decremented for product ${item.product_id}`);
            }
          }
        } else {
          console.warn('⚠️ No order items found in JSON field for order:', order.id);
        }


        // Get user details for email
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('full_name, email')
          .eq('id', metadata.user_id)
          .single();


        return res.json({
          received: true,
          message: 'Payment processed successfully',
          order_id: updatedOrder.id
        });
      }
    }

    // Handle failed payment
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
            order_status: 'cancelled',
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

/**
 * Manual verification endpoint - BACKUP verification method
 * Used when user returns from Paystack or for manual verification
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ error: 'Payment reference is required' });
    }

    console.log('🔍 Manual verification requested for:', reference);

    // Verify with Paystack API
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const { data: paymentData } = response.data;

    if (paymentData.status === 'success') {
      // Get order from reference
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('payment_reference', reference)
        .eq('user_id', req.user.id)
        .single();

      if (orderError || !order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Check if already processed
      if (order.payment_status === 'success') {
        return res.json({
          success: true,
          message: 'Payment already verified',
          order_id: order.id,
          already_processed: true
        });
      }

      // Update order (webhook might have already done this)
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'success',
          order_status: 'processing',
        })
        .eq('id', order.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Clear cart (in case webhook didn't)
      await supabaseAdmin
        .from('cart')
        .delete()
        .eq('user_id', req.user.id);

      console.log('✅ Manual verification successful:', order.id);

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        order_id: updatedOrder.id,
        order: updatedOrder
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed',
        gateway_response: paymentData.gateway_response
      });
    }

  } catch (error) {
    console.error('❌ Manual verification error:', error);

    if (error.response?.data) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed',
        details: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

/**
 * Check payment status - GET endpoint for frontend
 */
router.get('/status/:reference', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;

    // Get order by payment reference
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, payment_status, order_status, total, created_at')
      .eq('payment_reference', reference)
      .eq('user_id', req.user.id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      order_id: order.id,
      payment_status: order.payment_status,
      order_status: order.order_status,
      is_paid: order.payment_status === 'success',
      total: order.total,
      created_at: order.created_at
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/**
 * Test webhook endpoint - for development
 */
router.get('/webhook/test', (req, res) => {
  res.json({
    status: 'Webhook endpoint is active',
    url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/paystack/webhook`,
    method: 'POST',
    note: 'Configure this URL in your Paystack dashboard under Settings > Webhooks',
    events_to_enable: [
      'charge.success',
      'charge.failed'
    ]
  });
});

export default router;