import express from 'express';
import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';
import { calculateOrderTotals, validateNigerianState } from '../utils/delivery.js';
import { sendOrderConfirmationEmail } from '../utils/emailService.js';

const router = express.Router();

// Create order and initialize payment
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { state, city, address, phone, discount_code, email } = req.body;

    // Validate required fields
    if (!state || !city || !address) {
      return res.status(400).json({ 
        error: 'Missing required fields: state, city, and address are required' 
      });
    }

    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required for payment processing' 
      });
    }

    // Validate state
    if (!validateNigerianState(state)) {
      return res.status(400).json({ error: 'Invalid Nigerian state' });
    }

    // Get user cart
    const { data: cartItems, error: cartError } = await supabaseAdmin
      .from('cart')
      .select(`
        quantity,
        products (id, name, price, stock)
      `)
      .eq('user_id', req.user.id);

    if (cartError) {
      throw cartError;
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check stock and prepare order items
    const orderItems = [];
    for (const item of cartItems) {
      if (item.products.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.products.name}` 
        });
      }

      orderItems.push({
        product_id: item.products.id,
        product_name: item.products.name,
        quantity: item.quantity,
        price: item.products.price
      });
    }

    // Calculate totals
    const totals = calculateOrderTotals(orderItems, state);
  // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          user_id: req.user.id,
          order_items: orderItems,
          subtotal: totals.subtotal,
          delivery_fee: totals.deliveryFee,
          discount_code: discount_code || null,
          total: totals.total,
          state,
          city,
          address,
          phone: phone || null,
          payment_status: 'pending',
          order_status: 'pending'
        }
      ])
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Send order confirmation email (non-blocking)
    try {
      // Get user details for email
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('full_name, email')
        .eq('id', req.user.id)
        .single();

      await sendOrderConfirmationEmail(
        order, 
        email, // Use the email from request body
        userData?.full_name || 'Customer'
      );
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
      // Don't fail the order creation if email fails
    }
    // Initialize Paystack payment
    try {
      const paystackResponse = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email,
          amount: Math.round(order.total * 100), // Convert to kobo
          reference: `order_${order.id}_${Date.now()}`,
          callback_url: `${process.env.FRONTEND_URL}/verify-payment`,
          metadata: {
            order_id: order.id,
            user_id: req.user.id,
            custom_fields: [
              {
                display_name: "Order ID",
                variable_name: "order_id",
                value: order.id
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

      const { data: paystackData } = paystackResponse.data;

      // Update order with payment reference
      await supabaseAdmin
        .from('orders')
        .update({ 
          payment_reference: paystackData.reference 
        })
        .eq('id', order.id);

      // Return order and payment details
      res.status(201).json({
        message: 'Order created successfully',
        order: {
          ...order,
          payment_reference: paystackData.reference
        },
        payment: {
          authorization_url: paystackData.authorization_url,
          access_code: paystackData.access_code,
          reference: paystackData.reference
        }
      });

    } catch (paystackError) {
      console.error('Paystack initialization error:', paystackError.response?.data || paystackError);
      
      // Order was created but payment initialization failed
      // You might want to delete the order or mark it as failed
      await supabaseAdmin
        .from('orders')
        .update({ order_status: 'payment_failed' })
        .eq('id', order.id);

      return res.status(500).json({ 
        error: 'Order created but payment initialization failed',
        order_id: order.id,
        details: paystackError.response?.data
      });
    }

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: orders, error, count } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    res.json({
      orders: orders || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' });
      }
      throw error;
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Retry payment for existing order
router.post('/:id/retry-payment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.payment_status === 'success') {
      return res.status(400).json({ error: 'Order already paid' });
    }

    // Initialize payment
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(order.total * 100),
        reference: `order_${order.id}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/verify-payment`,
        metadata: {
          order_id: order.id,
          user_id: req.user.id
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { data: paystackData } = paystackResponse.data;

    // Update payment reference
    await supabaseAdmin
      .from('orders')
      .update({ payment_reference: paystackData.reference })
      .eq('id', order.id);

    res.json({
      message: 'Payment initialized successfully',
      payment: {
        authorization_url: paystackData.authorization_url,
        access_code: paystackData.access_code,
        reference: paystackData.reference
      }
    });

  } catch (error) {
    console.error('Retry payment error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

export default router;