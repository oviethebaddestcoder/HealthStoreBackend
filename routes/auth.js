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
      from: 'Health-Excellence <HealthExcellence@resend.dev>',
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
    const emailSent = await sendEmail(
      email,
      'Verify Your Email Address',
      `
        <h2>Welcome to Our App!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email
        </a>
        <p>Or copy this link: ${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      `
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
    const emailSent = await sendEmail(
      email,
      'Verify Your Email Address',
      `
        <h2>Verify Your Email Address</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email
        </a>
        <p>Or copy this link: ${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      `
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
      .select('id, email, auth_provider')
      .eq('email', email)
      .single();

    if (userError || !user) {
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
    const emailSent = await sendEmail(
      email,
      'Reset Your Password',
      `
        <h2>Reset Your Password</h2>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
        <p>Or copy this link: ${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
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