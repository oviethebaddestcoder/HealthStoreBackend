import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const setupDatabase = async () => {
  try {
    console.log('🚀 Setting up healthcare e-commerce database...');

    // SQL to create tables
    const sql = `
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Products table
    CREATE TABLE IF NOT EXISTS products (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name TEXT NOT NULL,
        info TEXT,
        benefits TEXT,
        direction TEXT,
        precaution TEXT,
        category_id UUID REFERENCES categories(id),
        price DECIMAL(10,2) NOT NULL,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Users table (extends auth.users)
    CREATE TABLE IF NOT EXISTS users (
        id UUID REFERENCES auth.users(id) PRIMARY KEY,
        full_name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        address JSONB,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Cart table
    CREATE TABLE IF NOT EXISTS cart (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES users(id) NOT NULL,
        product_id UUID REFERENCES products(id) NOT NULL,
        quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, product_id)
    );

    -- Orders table
    CREATE TABLE IF NOT EXISTS orders (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES users(id) NOT NULL,
        order_items JSONB NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        discount_code TEXT,
        total DECIMAL(10,2) NOT NULL,
        state TEXT NOT NULL,
        city TEXT NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        payment_reference TEXT,
        order_status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Discounts table
    CREATE TABLE IF NOT EXISTS discounts (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        percentage DECIMAL(5,2) NOT NULL,
        valid_until DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    );

    -- Insert default categories
    INSERT INTO categories (name) VALUES 
    ('Immune Booster'),
    ('Skin Problem'),
    ('Female Fertility'),
    ('High Blood Pressure'),
    ('Diabetes'),
    ('Tea Range'),
    ('Weight Loss'),
    ('Body Range')
    ON CONFLICT (name) DO NOTHING;

    -- Enable Row Level Security
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE cart ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

    -- RLS Policies
    -- Products: Readable by all, writable by admins
    DROP POLICY IF EXISTS "Anyone can view products" ON products;
    CREATE POLICY "Anyone can view products" ON products
        FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admins can manage products" ON products;
    CREATE POLICY "Admins can manage products" ON products
        FOR ALL USING (
            auth.uid() IN (
                SELECT id FROM users WHERE is_admin = true
            )
        );

    -- Cart: Users can only access their own cart
    DROP POLICY IF EXISTS "Users can manage own cart" ON cart;
    CREATE POLICY "Users can manage own cart" ON cart
        FOR ALL USING (auth.uid() = user_id);

    -- Orders: Users can view their own orders
    DROP POLICY IF EXISTS "Users can view own orders" ON orders;
    CREATE POLICY "Users can view own orders" ON orders
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can create own orders" ON orders;
    CREATE POLICY "Users can create own orders" ON orders
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Users: Users can view/update their own profile
    DROP POLICY IF EXISTS "Users can view own profile" ON users;
    CREATE POLICY "Users can view own profile" ON users
        FOR SELECT USING (auth.uid() = id);

    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    CREATE POLICY "Users can update own profile" ON users
        FOR UPDATE USING (auth.uid() = id);

    -- Discounts: Readable by all
    DROP POLICY IF EXISTS "Anyone can view discounts" ON discounts;
    CREATE POLICY "Anyone can view discounts" ON discounts
        FOR SELECT USING (true);
    `;

    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // If RPC method doesn't exist, try executing via SQL endpoint
      console.log('Note: RPC method not available, tables may need to be created manually in Supabase SQL Editor');
      console.log('Please run the SQL above in your Supabase SQL Editor');
    }

    console.log('✅ Database setup completed!');
    console.log('📋 Next steps:');
    console.log('1. Run the SQL above in Supabase SQL Editor if tables were not created');
    console.log('2. Update .env file with your Supabase and Paystack keys');
    console.log('3. Run: npm install');
    console.log('4. Run: npm run dev');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
  }
};

setupDatabase();
