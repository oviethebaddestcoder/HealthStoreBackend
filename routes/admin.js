import express from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAdmin } from '../middleware/admin.js';
import { productSchema, validateRequest } from '../utils/helpers.js';
import dotenv from 'dotenv';
import { generateToken, hashPassword } from '../utils/auth.js';
import cloudinary from '../config/cloudinary.js';

dotenv.config();

const router = express.Router();

// Admin dashboard stats
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    // Get total orders, revenue, etc.
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('total, payment_status, created_at');

    if (ordersError) throw ordersError;

    const totalRevenue = orders
      .filter(order => order.payment_status === 'success')
      .reduce((sum, order) => sum + parseFloat(order.total), 0);

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id', { count: 'exact' });

    if (productsError) throw productsError;

    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact' });

    if (usersError) throw usersError;

    res.json({
      stats: {
        totalOrders: orders.length,
        totalRevenue,
        totalProducts: products.length,
        totalUsers: users.length,
        pendingOrders: orders.filter(order => order.payment_status === 'pending').length
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});



// Configure multer for memory storage (for Cloudinary)
const storage = multer.memoryStorage(); // Changed from diskStorage

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Admin registration - FIXED bcrypt issue
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, phone, secret_key } = req.body;

    if (secret_key !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({ error: 'Invalid admin secret key' });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Ensure password is a string
    const passwordString = String(password || '');
    const hashedPassword = await hashPassword(passwordString);

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          full_name,
          phone,
          is_admin: true,
          is_verified: true
        }
      ])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    const token = generateToken({ userId: userData.id });

    res.status(201).json({
      message: 'Admin user registered successfully',
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        phone: userData.phone,
        is_admin: userData.is_admin,
        is_verified: userData.is_verified
      },
      token
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Admin registration failed' });
  }
});

// Product creation with image upload - FIXED
router.post('/products', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, info, benefits, direction, precaution, category_id, price, stock } = req.body;

    // Validate required fields
    if (!name || !category_id || !price || !stock) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, category_id, price, stock' 
      });
    }

    let imageUrl = '';

    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        // Convert buffer to base64
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        // Upload to Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
          folder: 'health-excellence/products',
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        });

        imageUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    }

    // Create product in database
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert([{
        name,
        info: info || '',
        benefits: benefits || '',
        direction: direction || '',
        precaution: precaution || '',
        category_id,
        price: parseFloat(price),
        stock: parseInt(stock),
        image_url: imageUrl
      }])
      .select(`
        *,
        categories (name)
      `)
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Product update - FIXED
router.put('/products/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, info, benefits, direction, precaution, category_id, price, stock } = req.body;

    // Validate required fields
    if (!name || !category_id || !price || !stock) {
      return res.status(400).json({
        error: 'Missing required fields: name, category_id, price, stock'
      });
    }

    let imageUrl = '';

    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        // Convert buffer to base64
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        // Upload to Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
          folder: 'health-excellence/products',
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        });

        imageUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    }

    // Prepare update data
    const updateData = {
      name,
      info: info || '',
      benefits: benefits || '',
      direction: direction || '',
      precaution: precaution || '',
      category_id,
      price: parseFloat(price),
      stock: parseInt(stock),
      updated_at: new Date().toISOString()
    };

    // Only update image_url if a new image was uploaded
    if (imageUrl) {
      updateData.image_url = imageUrl;
    }

    // Update product in database
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        categories (name)
      `)
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Add error handling middleware at the end
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected field' });
    }
  }
  
  console.error('Admin route error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Order management
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        users (full_name, email, phone)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('order_status', status);
    }

    const { data: orders, error, count } = await query.range(from, to);

    if (error) throw error;

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
    console.error('Get admin orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.put('/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status } = req.body;

    const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(order_status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ order_status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
