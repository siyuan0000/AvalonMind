# AvalonMind Authentication Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
# Install TypeScript compiler (if not already installed)
npm install -g typescript

# Install Supabase client
npm install @supabase/supabase-js

# Install Zod for validation
npm install zod

# Install React dependencies (for hooks pattern)
npm install react react-dom
```

### 2. Configure Supabase

#### Create a Supabase Project:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Note your:
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **Anon Key**: Found in Settings > API

#### Configure Authentication:
1. Go to **Authentication > Settings**
2. Set **Site URL**: `https://your-domain.com` (production) or `http://localhost:5000` (development)
3. Add **Redirect URLs**:
   - `http://localhost:5000/auth/callback`
   - `https://your-domain.com/auth/callback`
4. Enable **Email Confirmations**
5. Configure **Email Provider** (SMTP settings)

#### Set Up Database Schema:
Run the SQL from `SUPABASE_CONFIG_CHECKLIST.md` in the SQL Editor.

### 3. Configure Environment Variables

#### Frontend (in `index.html`):
```html
<script>
    window.SUPABASE_URL = 'https://your-project-ref.supabase.co';
    window.SUPABASE_ANON_KEY = 'your-anon-key';
</script>
```

#### Backend (`.env.local`):
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
FLASK_SECRET_KEY=your-flask-secret-key
```

### 4. Build TypeScript Files
```bash
# Compile TypeScript to JavaScript
cd /Users/liusiyuan/Desktop/poly/research/AvalonMind/static/auth

# Install local dependencies
npm init -y
npm install @supabase/supabase-js zod

# Create tsconfig.json
echo '{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "lib": ["es2020", "dom"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["*.ts", "components/*.tsx"],
  "exclude": ["node_modules", "dist"]
}' > tsconfig.json

# Compile
npx tsc
```

### 5. Test the System

#### Development Testing:
1. Start the Flask server:
   ```bash
   cd /Users/liusiyuan/Desktop/poly/research/AvalonMind
   python run.py
   ```

2. Open `http://localhost:5000`
3. Test registration with email confirmation
4. Test login with confirmed account
5. Test all edge cases from `EDGE_CASE_MATRIX.md`

#### Production Deployment:
1. Update Supabase configuration for production domain
2. Set up HTTPS certificates
3. Configure production environment variables
4. Run comprehensive tests

## File Structure

```
static/auth/
├── types.ts              # TypeScript type definitions
├── schemas.ts            # Zod validation schemas
├── supabase.service.ts   # Supabase API service layer
├── useAuth.ts           # React-style authentication hook
├── integration.js       # Legacy system integration bridge
└── components/
    └── AuthModal.tsx    # Enterprise-grade UI component
```

## Migration Strategy

### Phase 1: Parallel Run (Recommended)
1. **Keep both systems**: New and old auth coexist
2. **Feature flag**: Control which system is active
3. **Monitor metrics**: Compare performance and error rates
4. **User testing**: Get feedback from beta users

### Phase 2: Gradual Rollout
1. **10% users**: Start with small percentage
2. **Increase gradually**: 25% → 50% → 75% → 100%
3. **Monitor closely**: Watch for errors and performance issues
4. **Ready to rollback**: Have rollback plan prepared

### Phase 3: Full Migration
1. **Disable legacy**: Turn off old auth system
2. **Clean up code**: Remove legacy auth functions
3. **Update documentation**: Reflect new system
4. **Post-migration review**: Analyze results and lessons

## Testing Checklist

### Unit Tests:
```bash
# Test validation schemas
npx jest schemas.test.ts

# Test error mapping
npx jest supabase.service.test.ts

# Test state management
npx jest useAuth.test.ts
```

### Integration Tests:
1. Full registration flow
2. Email confirmation flow
3. Login with various scenarios
4. Session management
5. Error recovery

### E2E Tests:
1. Complete user journey
2. Cross-browser testing
3. Mobile device testing
4. Accessibility testing

## Monitoring & Alerts

### Key Metrics to Monitor:
1. **Registration Success Rate**: Should be >95%
2. **Email Delivery Rate**: Should be >99%
3. **Login Failure Rate**: Alert if >10%
4. **Session Timeout Rate**: Monitor for anomalies

### Alert Conditions:
1. **Spike in Failed Logins**: Possible attack
2. **Low Email Delivery**: SMTP issues
3. **High API Latency**: Performance degradation
4. **CORS Errors**: Configuration issues

## Troubleshooting

### Common Issues:

#### 1. Email Not Sending
- Check Supabase SMTP configuration
- Verify email templates
- Check spam folder
- Test with different email providers

#### 2. Redirect Errors
- Verify redirect URLs in Supabase dashboard
- Check CORS settings
- Ensure HTTPS in production
- Test with different browsers

#### 3. Session Issues
- Check cookie settings
- Verify domain configuration
- Test in private/incognito mode
- Clear browser cache

#### 4. TypeScript Compilation Errors
- Check TypeScript version
- Verify dependencies
- Check tsconfig.json
- Look for syntax errors

### Debug Steps:
1. Check browser console for errors
2. Verify network requests in DevTools
3. Check Supabase logs in dashboard
4. Test with different browsers
5. Clear browser cache and cookies

## Performance Optimization

### Bundle Size:
- **Code splitting**: Auth components loaded on demand
- **Tree shaking**: Remove unused code
- **Lazy loading**: Load modules when needed
- **Compression**: Enable gzip/brotli compression

### Network:
- **CDN**: Use CDN for static assets
- **Caching**: Implement proper caching headers
- **Compression**: Compress API responses
- **Connection pooling**: Reuse connections

### Memory:
- **Efficient state**: Minimal data in memory
- **Cleanup**: Proper resource cleanup
- **Garbage collection**: Monitor memory usage
- **Optimization**: Profile and optimize hotspots

## Security Considerations

### 1. Input Validation
- **Client-side**: Immediate feedback for users
- **Server-side**: Final validation and sanitization
- **Database**: Parameterized queries, RLS policies

### 2. Session Security
- **Secure cookies**: HttpOnly, Secure, SameSite
- **Token rotation**: Regular token refresh
- **Session timeout**: Automatic logout after inactivity
- **Device tracking**: Monitor suspicious devices

### 3. Rate Limiting
- **API limits**: Protect against brute force
- **Email limits**: Prevent spam
- **IP blocking**: Temporary blocks for attacks
- **User limits**: Fair usage policies

### 4. Data Protection
- **Encryption**: Data in transit and at rest
- **Backups**: Regular database backups
- **Audit logs**: Track all authentication events
- **Compliance**: Follow privacy regulations

## Maintenance

### Regular Tasks:
1. **Update dependencies**: Keep libraries current
2. **Review logs**: Weekly security review
3. **Backup verification**: Test restore procedures
4. **Performance monitoring**: Track metrics over time

### User Support:
1. **Password reset**: Self-service option
2. **Account recovery**: Email-based recovery
3. **Support tickets**: Track and resolve issues
4. **Documentation**: Keep user guides updated

### System Updates:
1. **Security patches**: Apply promptly
2. **Feature updates**: Regular improvements
3. **Breaking changes**: Communicate clearly
4. **Deprecation notices**: Give advance warning

## Support Resources

### Documentation:
- **Supabase Docs**: https://supabase.com/docs
- **TypeScript Docs**: https://www.typescriptlang.org/docs
- **Zod Docs**: https://zod.dev
- **React Docs**: https://react.dev

### Community:
- **Supabase Discord**: https://discord.supabase.com
- **GitHub Issues**: Report bugs and feature requests
- **Stack Overflow**: Community support
- **Twitter**: Latest updates and announcements

### Professional Support:
- **Supabase Support**: Enterprise support plans
- **Consultants**: Authentication experts
- **Security Audits**: Regular security reviews
- **Training**: Team training sessions

## Success Metrics

### Technical Metrics:
- **Uptime**: 99.9% availability
- **Response Time**: <200ms for auth operations
- **Error Rate**: <1% for critical paths
- **User Satisfaction**: >4.5/5 rating

### Business Metrics:
- **User Growth**: Monthly active users
- **Retention**: User retention rate
- **Conversion**: Free to paid conversion
- **Support Tickets**: Reduced support volume

### Security Metrics:
- **Security Incidents**: Zero major incidents
- **Compliance**: All regulations met
- **Audit Results**: Positive security audits
- **User Trust**: High trust scores

---

**Last Updated**: 2026-03-16  
**Version**: 1.0.0  
**Status**: Ready for implementation  
**Next Review**: 2026-06-16 (Quarterly review)