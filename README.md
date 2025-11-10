# 🏥 Healthcare E-commerce Backend

A complete Node.js/Express backend for a healthcare e-commerce platform with Supabase and Paystack integration.

## 🚀 Features

- **User Authentication** - JWT-based auth with Supabase
- **Product Management** - CRUD operations for healthcare products
- **Shopping Cart** - Add, update, remove items
- **Order Management** - Create and track orders
- **Payment Integration** - Paystack for Nigerian payments
- **Admin Dashboard** - Manage products, orders, and users
- **Delivery Calculation** - Automatic fee calculation based on location

## 📋 Prerequisites

- Node.js 18+
- Supabase account
- Paystack account

## 🛠 Setup Instructions

1. **Clone and install dependencies:**
   \`\`\`bash
   cd backend
   npm install
   \`\`\`

2. **Configure environment variables:**
   - Copy `.env` and update with your actual keys
   - Get Supabase keys from your project settings
   - Get Paystack keys from your Paystack dashboard

3. **Set up database:**
   - Run the SQL from `scripts/setup-db.js` in Supabase SQL Editor
   - Or run: `npm run db:setup`

4. **Start the server:**
   \`\`\`bash
   npm run dev  # Development
   npm start    # Production
   \`\`\`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - Get all products (with filtering)
- `GET /api/products/:id` - Get single product
- `GET /api/products/categories/all` - Get all categories

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart/add` - Add to cart
- `PUT /api/cart/update/:id` - Update cart item
- `DELETE /api/cart/remove/:id` - Remove from cart

### Orders
- `POST /api/orders/create` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get single order

### Payment
- `POST /api/paystack/initialize` - Initialize Paystack payment
- `POST /api/paystack/webhook` - Paystack webhook
- `GET /api/paystack/verify/:reference` - Verify payment

### Admin
- `GET /api/admin/dashboard` - Admin stats
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `GET /api/admin/orders` - Get all orders

## 🔐 Environment Variables

\`\`\`
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
PAYSTACK_SECRET_KEY=your_paystack_secret
PAYSTACK_PUBLIC_KEY=your_paystack_public
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:3000
PORT=5000
\`\`\`

## 🗄 Database Schema

See `scripts/setup-db.js` for complete table definitions and RLS policies.

## 🚀 Deployment

The backend is ready for deployment on platforms like:
- Railway
- Render
- Heroku
- DigitalOcean App Platform

Make sure to set environment variables in your deployment platform.
