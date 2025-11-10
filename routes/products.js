import express from 'express';
import { supabase } from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Search bar endpoint - optimized for autocomplete/search suggestions
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { 
      q,           // search query
      limit = 10,  // smaller limit for search suggestions
      fields = 'name,benefits,info' // searchable fields
    } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ 
        results: [],
        message: 'Please provide a search query'
      });
    }

    // Minimum search length (optional)
    if (q.trim().length < 2) {
      return res.json({ 
        results: [],
        message: 'Search query too short. Please enter at least 2 characters.'
      });
    }

    const searchTerm = q.trim();
    const searchFields = fields.split(',');
    
    // Build search conditions
    const searchConditions = searchFields
      .map(field => `${field}.ilike.%${searchTerm}%`)
      .join(',');

    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        price,
        image_url,
        categories (
          id,
          name
        )
      `)
      .or(searchConditions)
      .limit(parseInt(limit));

    const { data: results, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      results,
      count: results.length,
      query: searchTerm
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all products with pagination and filtering
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      category, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    let query = supabase
      .from('products')
      .select(`
        *,
        categories (name)
      `, { count: 'exact' });

    // Apply filters
    if (category) {
      query = query.eq('category_id', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,benefits.ilike.%${search}%,info.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data: products, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Product not found' });
      }
      throw error;
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get categories
router.get('/categories/all', async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      throw error;
    }

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;