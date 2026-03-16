# Supabase Configuration Checklist for AvalonMind

## Dashboard Settings

### 1. Authentication Settings
- [ ] **Site URL**: Set to your production domain (e.g., `https://avalonmind.example.com`)
- [ ] **Redirect URLs**: Add both development and production URLs:
  - Development: `http://localhost:5000/auth/callback`
  - Production: `https://your-domain.com/auth/callback`
  - Wildcard: `http://localhost:5000/**` (for development)
- [ ] **Email Provider**: Configure SMTP settings for email confirmation
- [ ] **Enable Email Confirmations**: Ensure email confirmations are enabled

### 2. Email Templates
- [ ] **Confirm Signup**: Customize the email confirmation template
- [ ] **Magic Link**: Disable if not using magic links
- [ ] **Invite User**: Configure if using team features
- [ ] **Reset Password**: Configure password reset emails

### 3. Security Settings
- [ ] **Password Requirements**: Set minimum length to 8 characters
- [ ] **Enable PKCE Flow**: Ensure PKCE is enabled for OAuth
- [ ] **Session Timeout**: Configure session duration (default: 3600 seconds)
- [ ] **Rate Limiting**: Review and adjust rate limits if needed

### 4. OAuth Providers (Optional)
- [ ] **Google OAuth**: Configure if using Google sign-in
- [ ] **GitHub OAuth**: Configure if using GitHub sign-in
- [ ] **Apple OAuth**: Configure if needed for iOS apps

## Database Schema

### 1. User Profiles Table
```sql
-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_vip BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (true);
```

### 2. Game Logs Table
```sql
-- Create game_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS game_logs (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  winner TEXT NOT NULL,
  log_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_game_logs_user_id ON game_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_game_logs_timestamp ON game_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON game_logs(game_id);

-- Enable Row Level Security
ALTER TABLE game_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own game logs"
  ON game_logs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "System can insert game logs"
  ON game_logs FOR INSERT
  WITH CHECK (true);
```

### 3. User Usage Table (Optional)
```sql
-- Create user_usage table for token tracking
CREATE TABLE IF NOT EXISTS user_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_tokens BIGINT DEFAULT 0,
  model TEXT DEFAULT 'deepseek-chat',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, model)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);

-- Enable Row Level Security
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own usage"
  ON user_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can update usage"
  ON user_usage FOR ALL
  USING (true);
```

## Environment Variables

### 1. Frontend (.env or config)
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SITE_URL=http://localhost:5000  # Development
VITE_SITE_URL=https://avalonmind.example.com  # Production
VITE_EMAIL_REDIRECT_TO=${VITE_SITE_URL}/auth/callback
```

### 2. Backend (.env.local)
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
FLASK_SECRET_KEY=your-flask-secret-key
```

## Testing Checklist

### 1. Development Environment
- [ ] **Localhost URLs**: Confirm `http://localhost:5000` works
- [ ] **Email Redirect**: Test email confirmation flow locally
- [ ] **Session Persistence**: Verify sessions persist across page reloads
- [ ] **Error Handling**: Test various error scenarios

### 2. Production Environment
- [ ] **HTTPS**: Ensure all URLs use HTTPS
- [ ] **Domain Verification**: Verify domain in Supabase dashboard
- [ ] **Email Delivery**: Test email delivery in production
- [ ] **CORS**: Configure CORS settings for your domain

### 3. Security Testing
- [ ] **Password Validation**: Test weak password rejection
- [ ] **Rate Limiting**: Verify rate limits work
- [ ] **Session Security**: Test session invalidation on logout
- [ ] **XSS Protection**: Verify input sanitization

## Monitoring & Logs

### 1. Supabase Dashboard
- [ ] **Authentication Logs**: Monitor signups and logins
- [ ] **Error Rates**: Watch for authentication failures
- [ ] **Active Users**: Track user engagement
- [ ] **Storage Usage**: Monitor database growth

### 2. Application Logs
- [ ] **Auth Events**: Log authentication events
- [ ] **Error Tracking**: Implement error tracking (Sentry, etc.)
- [ ] **Performance Metrics**: Track auth API response times

## Backup & Recovery

### 1. Database Backups
- [ ] **Automatic Backups**: Enable daily backups in Supabase
- [ ] **Point-in-Time Recovery**: Enable if needed
- [ ] **Export Schema**: Keep schema exports in version control

### 2. Disaster Recovery
- [ ] **Environment Backups**: Backup environment variables
- [ ] **Configuration Backups**: Backup Supabase configuration
- [ ] **Recovery Plan**: Document recovery procedures

## Maintenance

### 1. Regular Tasks
- [ ] **Review Logs**: Weekly review of auth logs
- [ ] **Update Dependencies**: Keep Supabase client updated
- [ ] **Security Patches**: Apply security updates promptly

### 2. User Management
- [ ] **Inactive Users**: Consider cleanup policies
- [ ] **VIP Management**: Process VIP upgrades/downgrades
- [ ] **Support Requests**: Handle user account issues

## Troubleshooting

### Common Issues:
1. **Email not sending**: Check SMTP configuration
2. **Redirect errors**: Verify redirect URLs in Supabase dashboard
3. **CORS errors**: Check CORS settings in Supabase
4. **Session issues**: Verify cookie settings and domain
5. **Rate limiting**: Adjust limits in Supabase dashboard

### Debug Steps:
1. Check browser console for errors
2. Verify network requests in DevTools
3. Check Supabase logs in dashboard
4. Test with different browsers
5. Clear browser cache and cookies

## Support Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **GitHub Issues**: Report bugs and feature requests
- **Stack Overflow**: Community support

---

**Last Updated**: 2026-03-16  
**Version**: 1.0.0  
**Maintainer**: AvalonMind Development Team