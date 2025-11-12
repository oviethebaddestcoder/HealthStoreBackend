import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/supabase.js';
import { Resend } from 'resend';
import passport from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Utility functions
const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};
const sendEmail = async (to, subject, html) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Health Excellence <hello@healthexcellence.shop>',
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Email error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

// Modern Email Template Generator
const generateEmailTemplate = (type, data) => {
  const currentYear = new Date().getFullYear();
  
  const templates = {
    verification: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Health Excellence</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a202c;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          
          .email-wrapper {
            max-width: 500px;
            margin: 0 auto;
          }
          
          .email-container {
            background: white;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(10px);
          }
          
          .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 50px 40px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 20px 20px;
            animation: float 20s linear infinite;
          }
          
          @keyframes float {
            0% { transform: translate(0, 0) rotate(0deg); }
            100% { transform: translate(-20px, -20px) rotate(360deg); }
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
          }
          
          .logo-icon {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            width: 90px;
            height: 90px;
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 42px;
            font-weight: bold;
            margin: 0 auto 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
          }
          
          .brand-name {
            color: white;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
            margin: 0 0 8px 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .brand-tagline {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 400;
            margin: 0;
          }
          
          .content {
            padding: 50px 40px;
            background: white;
          }
          
          .greeting {
            font-size: 24px;
            color: #1a202c;
            margin-bottom: 24px;
            font-weight: 600;
            text-align: center;
          }
          
          .welcome-text {
            font-size: 18px;
            color: #4a5568;
            text-align: center;
            margin-bottom: 8px;
            font-weight: 500;
          }
          
          .message {
            color: #718096;
            margin-bottom: 32px;
            font-size: 16px;
            line-height: 1.7;
            text-align: center;
          }
          
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          
          .verify-button {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 20px 48px;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 600;
            font-size: 17px;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
            letter-spacing: 0.5px;
            position: relative;
            overflow: hidden;
          }
          
          .verify-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
          }
          
          .verify-button:hover::before {
            left: 100%;
          }
          
          .verify-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4);
          }
          
          .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin: 40px 0;
          }
          
          .feature-item {
            text-align: center;
            padding: 20px;
            background: #f7fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
          }
          
          .feature-icon {
            font-size: 24px;
            margin-bottom: 12px;
          }
          
          .feature-text {
            font-size: 14px;
            color: #4a5568;
            font-weight: 500;
          }
          
          .expiry-notice {
            background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
            border: none;
            padding: 20px;
            border-radius: 12px;
            margin: 32px 0;
            text-align: center;
            color: #7c2d12;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(251, 146, 60, 0.2);
          }
          
          .link-container {
            background: #f7fafc;
            padding: 20px;
            border-radius: 12px;
            margin: 24px 0;
            border: 1px solid #e2e8f0;
          }
          
          .link-label {
            color: #4a5568;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          
          .verification-link {
            color: #2d3748;
            font-size: 14px;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            background: white;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          
          .security-note {
            background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%);
            border: none;
            padding: 20px;
            border-radius: 12px;
            margin-top: 32px;
            text-align: center;
            color: #22543d;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(72, 187, 120, 0.2);
          }
          
          .footer {
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          
          .footer-text {
            color: #cbd5e0;
            font-size: 14px;
            margin-bottom: 8px;
          }
          
          .social-links {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 20px 0;
          }
          
          .social-link {
            color: #cbd5e0;
            text-decoration: none;
            font-size: 14px;
            transition: color 0.3s ease;
          }
          
          .social-link:hover {
            color: #10b981;
          }
          
          .support {
            color: #a0aec0;
            font-size: 13px;
            margin-top: 20px;
          }
          
          .support-link {
            color: #10b981;
            text-decoration: none;
            font-weight: 500;
          }
          
          @media (max-width: 600px) {
            body {
              padding: 10px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .header {
              padding: 40px 20px 30px;
            }
            
            .logo-icon {
              width: 70px;
              height: 70px;
              font-size: 32px;
            }
            
            .brand-name {
              font-size: 24px;
            }
            
            .verify-button {
              padding: 18px 36px;
              font-size: 16px;
            }
            
            .feature-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="logo-container">
                <h1 class="brand-name">Health Excellence</h1>
                <div class="brand-tagline">Your Journey to Better Health</div>
              </div>
            </div>
            
            <div class="content">
              <div class="greeting">Welcome${data.full_name ? `, ${data.full_name}` : ''}! 🌟</div>
              <div class="welcome-text">Ready to start your wellness journey?</div>
              
              <div class="message">
                Thank you for choosing Health Excellence! We're thrilled to welcome you to our community of health enthusiasts. Verify your email to unlock all features and start your transformation.
              </div>
              
              <div class="button-container">
                <a href="${data.verificationUrl}" class="verify-button">
                  <span>✅ Verify Email Address</span>
                </a>
              </div>
              
              <div class="feature-grid">
                <div class="feature-item">
                  <div class="feature-icon">💪</div>
                  <div class="feature-text">Personalized Plans</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">📊</div>
                  <div class="feature-text">Progress Tracking</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">👥</div>
                  <div class="feature-text">Expert Support</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">🎯</div>
                  <div class="feature-text">Smart Goals</div>
                </div>
              </div>
              
              <div class="expiry-notice">
                ⏰ This verification link expires in <strong>24 hours</strong>
              </div>
              
              <div class="link-container">
                <div class="link-label">Or copy and paste this link in your browser:</div>
                <div class="verification-link">${data.verificationUrl}</div>
              </div>
              
              <div class="security-note">
                🔒 Your security is our priority. This link is unique to you.
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">© ${currentYear} Health Excellence. All rights reserved.</div>
              <div class="footer-text">Transforming lives through better health</div>
              
              <div class="social-links">
                <a href="#" class="social-link">Website</a>
                <a href="#" class="social-link">Blog</a>
                <a href="#" class="social-link">Support</a>
              </div>
              
              <div class="support">
                Need help? <a href="mailto:hello@healthexcellence.shop" class="support-link">Contact our team</a>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    
    passwordReset: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Health Excellence</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a202c;
            background: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
            min-height: 100vh;
            padding: 20px;
          }
          
          .email-wrapper {
            max-width: 500px;
            margin: 0 auto;
          }
          
          .email-container {
            background: white;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          }
          
          .header {
            background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
            padding: 50px 40px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
            background-size: 20px 20px;
          }
          
          .logo-container {
            position: relative;
            z-index: 2;
          }
          
          .logo-icon {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            width: 90px;
            height: 90px;
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 42px;
            font-weight: bold;
            margin: 0 auto 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }
          
          .brand-name {
            color: white;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
            margin: 0 0 8px 0;
          }
          
          .brand-tagline {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 400;
            margin: 0;
          }
          
          .content {
            padding: 50px 40px;
            background: white;
          }
          
          .greeting {
            font-size: 24px;
            color: #1a202c;
            margin-bottom: 24px;
            font-weight: 600;
            text-align: center;
          }
          
          .message {
            color: #718096;
            margin-bottom: 32px;
            font-size: 16px;
            line-height: 1.7;
            text-align: center;
          }
          
          .button-container {
            text-align: center;
            margin: 40px 0;
          }
          
          .reset-button {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
            color: white;
            padding: 20px 48px;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 600;
            font-size: 17px;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 25px rgba(229, 62, 62, 0.3);
            letter-spacing: 0.5px;
          }
          
          .reset-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(229, 62, 62, 0.4);
          }
          
          .expiry-notice {
            background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
            border: none;
            padding: 20px;
            border-radius: 12px;
            margin: 32px 0;
            text-align: center;
            color: #7c2d12;
            font-weight: 600;
          }
          
          .link-container {
            background: #f7fafc;
            padding: 20px;
            border-radius: 12px;
            margin: 24px 0;
            border: 1px solid #e2e8f0;
          }
          
          .link-label {
            color: #4a5568;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          
          .reset-link {
            color: #2d3748;
            font-size: 14px;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            background: white;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          
          .security-note {
            background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
            border: none;
            padding: 20px;
            border-radius: 12px;
            margin-top: 32px;
            text-align: center;
            color: #742a2a;
            font-weight: 500;
          }
          
          .footer {
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
          }
          
          .footer-text {
            color: #cbd5e0;
            font-size: 14px;
            margin-bottom: 8px;
          }
          
          .support {
            color: #a0aec0;
            font-size: 13px;
            margin-top: 20px;
          }
          
          .support-link {
            color: #e53e3e;
            text-decoration: none;
            font-weight: 500;
          }
          
          @media (max-width: 600px) {
            body {
              padding: 10px;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .header {
              padding: 40px 20px 30px;
            }
            
            .logo-icon {
              width: 70px;
              height: 70px;
              font-size: 32px;
            }
            
            .brand-name {
              font-size: 24px;
            }
            
            .reset-button {
              padding: 18px 36px;
              font-size: 16px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="header">
              <div class="logo-container">
                <h1 class="brand-name">Health Excellence</h1>
                <div class="brand-tagline">Your Journey to Better Health</div>
              </div>
            </div>
            
            <div class="content">
              <div class="greeting">Hello${data.full_name ? `, ${data.full_name}` : ''}! 🔐</div>
              
              <div class="message">
                We received a request to reset your password. Click the button below to create a new secure password and regain access to your account.
              </div>
              
              <div class="button-container">
                <a href="${data.resetUrl}" class="reset-button">
                  <span>🔒 Reset Password</span>
                </a>
              </div>
              
              <div class="expiry-notice">
                ⏰ This reset link expires in <strong>1 hour</strong> for your security
              </div>
              
              <div class="link-container">
                <div class="link-label">Or copy and paste this link in your browser:</div>
                <div class="reset-link">${data.resetUrl}</div>
              </div>
              
              <div class="security-note">
                ⚠️ If you didn't request this reset, please ignore this email. Your account remains secure.
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text">© ${currentYear} Health Excellence. All rights reserved.</div>
              <div class="footer-text">Transforming lives through better health</div>
              
              <div class="support">
                Need help? <a href="mailto:hello@healthexcellence.shop" class="support-link">Contact our team</a>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  return templates[type];
};

// Helper functions
const generatePasswordResetTemplate = (data) => {
  return generateEmailTemplate('passwordReset', data);
};
// GOOGLE OAUTH

// Initiate Google OAuth
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  session: false 
}));

// Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`
  }),
  (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken({ userId: req.user.id });
      
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth/google/success?token=${token}`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);


// Register user (Email/Password)
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const hashedPassword = await hashPassword(password);
    const emailToken = generateToken({ email }, '1d');

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          full_name,
          phone,
          is_admin: false,
          is_verified: false,
          auth_provider: 'email',
          email_verification_token: emailToken
        }
      ])
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailToken}`;
    
    const emailHtml = generateEmailTemplate('verification', {
      full_name,
      verificationUrl
    });

    const emailSent = await sendEmail(
      email,
      'Verify Your Email - Health Excellence',
      emailHtml
    );

    const token = generateToken({ userId: userData.id });

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        phone: userData.phone,
        is_admin: userData.is_admin,
        is_verified: userData.is_verified,
        auth_provider: userData.auth_provider
      },
      token,
      emailSent
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email } = decoded;

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('email_verification_token', token)
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        is_verified: true, 
        email_verification_token: null 
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ 
      message: 'Email verified successfully! You can now log in to your account.' 
    });
  } catch (error) {
    console.error('Email verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Verification token has expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ error: 'Invalid verification token' });
    }
    
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const emailToken = generateToken({ email }, '1d');

    await supabaseAdmin
      .from('users')
      .update({ email_verification_token: emailToken })
      .eq('id', user.id);

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailToken}`;
    
    const emailHtml = generateEmailTemplate('verification', {
      full_name: user.full_name,
      verificationUrl
    });

    const emailSent = await sendEmail(
      email,
      'Verify Your Email - Health Excellence',
      emailHtml
    );

    res.json({ 
      message: 'Verification email sent successfully',
      emailSent
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Login user (Email/Password)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user signed up with Google
    if (user.auth_provider === 'google' && !user.password) {
      return res.status(401).json({ 
        error: 'This account uses Google Sign-In. Please sign in with Google.' 
      });
    }

    if (!user.is_verified) {
      return res.status(401).json({ 
        error: 'Please verify your email address before logging in' 
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ userId: user.id });
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, auth_provider')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // Return success even if user doesn't exist for security
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Check if user uses Google OAuth
    if (user.auth_provider === 'google') {
      return res.status(400).json({ 
        error: 'This account uses Google Sign-In. Please use Google to sign in.' 
      });
    }

    const resetToken = generateToken({ userId: user.id }, '1h');

    await supabaseAdmin
      .from('users')
      .update({ reset_password_token: resetToken })
      .eq('id', user.id);

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailHtml = generatePasswordResetTemplate({
      full_name: user.full_name,
      resetUrl
    });

    const emailSent = await sendEmail(
      email,
      'Reset Your Password - Health Excellence',
      emailHtml
    );

    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.',
      emailSent
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});
// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: 'Reset token and new password are required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = decoded;

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('reset_password_token', token)
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await hashPassword(newPassword);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        password: hashedPassword, 
        reset_password_token: null 
      })
      .eq('id', user.id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ 
      message: 'Password reset successfully! You can now log in with your new password.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, is_admin, address, is_verified, avatar_url, auth_provider, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone, address } = req.body;

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({ full_name, phone, address })
      .eq('id', req.user.id)
      .select('id, email, full_name, phone, is_admin, address, is_verified, avatar_url, auth_provider, created_at')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

export default router;