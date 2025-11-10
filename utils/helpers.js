import Joi from 'joi';

export const productSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  info: Joi.string().allow('').optional(),
  benefits: Joi.string().allow('').optional(),
  direction: Joi.string().allow('').optional(),
  precaution: Joi.string().allow('').optional(),
  category_id: Joi.string().uuid().required(),
  price: Joi.number().min(0).required(),
  stock: Joi.number().integer().min(0).required(),
  image_url: Joi.string().uri().allow('').optional()
});

export const orderSchema = Joi.object({
  state: Joi.string().min(2).max(100).required(),
  city: Joi.string().min(2).max(100).required(),
  discount_code: Joi.string().allow('').optional()
});

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(detail => detail.message) 
      });
    }
    next();
  };
};

export const handleSupabaseError = (error, res) => {
  console.error('Supabase error:', error);
  
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Duplicate record found' });
  }
  
  if (error.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found' });
  }
  
  return res.status(500).json({ error: 'Database operation failed' });
};
