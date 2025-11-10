import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { supabaseAdmin } from './supabase.js';
import dotenv from 'dotenv';

dotenv.config();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, is_admin, is_verified, address, created_at')
      .eq('id', id)
      .single();
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const fullName = profile.displayName;
        const googleId = profile.id;
        const avatar = profile.photos[0]?.value;

        // Check if user exists
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (existingUser) {
          // Update google_id if not set
          if (!existingUser.google_id) {
            await supabaseAdmin
              .from('users')
              .update({ google_id: googleId, avatar_url: avatar })
              .eq('id', existingUser.id);
          }
          return done(null, existingUser);
        }

        // Create new user
        const { data: newUser, error } = await supabaseAdmin
          .from('users')
          .insert([
            {
              email,
              full_name: fullName,
              google_id: googleId,
              avatar_url: avatar,
              is_verified: true, // Google emails are pre-verified
              is_admin: false,
              phone: '', // Can be updated later
            },
          ])
          .select()
          .single();

        if (error) throw error;

        done(null, newUser);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

export default passport;