import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user cart
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: cartItems, error } = await supabaseAdmin
      .from('cart')
      .select(`
        *,
        products (*)
      `)
      .eq('user_id', req.user.id);

    if (error) {
      throw error;
    }

    res.json({ cart: cartItems || [] });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add to cart
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Check if product exists and has stock
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('stock, price, name')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Add to cart (upsert to handle duplicates)
    const { data: cartItem, error } = await supabaseAdmin
      .from('cart')
      .upsert({
        user_id: req.user.id,
        product_id,
        quantity
      }, {
        onConflict: 'user_id,product_id'
      })
      .select(`
        *,
        products (*)
      `)
      .single();

    if (error) {
      throw error;
    }

    res.json({ 
      message: 'Product added to cart',
      cartItem 
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add product to cart' });
  }
});

// Update cart item quantity
router.put('/update/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      const { error } = await supabaseAdmin
        .from('cart')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

      if (error) {
        throw error;
      }

      return res.json({ message: 'Item removed from cart' });
    }

    // Check product stock
    const { data: cartItem, error: cartError } = await supabaseAdmin
      .from('cart')
      .select('products(stock)')
      .eq('id', id)
      .single();

    if (cartError) {
      throw cartError;
    }

    if (cartItem.products.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Update quantity
    const { data: updatedItem, error } = await supabaseAdmin
      .from('cart')
      .update({ quantity })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select(`
        *,
        products (*)
      `)
      .single();

    if (error) {
      throw error;
    }

    res.json({ 
      message: 'Cart updated',
      cartItem: updatedItem 
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove from cart
router.delete('/remove/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('cart')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      throw error;
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// Clear cart
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('cart')
      .delete()
      .eq('user_id', req.user.id);

    if (error) {
      throw error;
    }

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

export default router;
