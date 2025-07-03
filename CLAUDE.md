# Interlink Project Documentation

## Overview

Interlink is a lightweight, centralized system designed to ensure compliant-friendly card references across Kudos' marketing content. It provides an internal dashboard to manage card names, terms URLs, and statuses, coupled with a JavaScript snippet that dynamically replaces defined placeholders on public-facing pages.

## Architecture

### Tech Stack
- **Frontend**: Next.js (App Router) with TypeScript
- **Styling**: TailwindCSS with shadcn/ui components
- **Authentication**: Better Auth
- **Database**: Supabase with Row Level Security (RLS)
- **Hosting**: Vercel
- **JavaScript CDN**: Vercel Edge Network

### Core Components

1. **Admin Dashboard** (`/dashboard`)
   - Secure login with Better Auth
   - CRUD operations for card metadata
   - Real-time status management
   - User-scoped data access

2. **Database Schema**
   - `cards` table with RLS policies
   - User-scoped card management
   - Unique key constraints per user

3. **Public API** (`/api/public/cards/[userId]`)
   - Read-only access to active cards
   - CORS-enabled for cross-origin requests
   - Cached responses (5 minutes)

4. **JavaScript Snippet** (`/js/interlink.min.js`)
   - Lightweight (<5kb minified)
   - Client-side placeholder replacement
   - Local caching for performance
   - Graceful fallback handling

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- Supabase account
- Vercel account (optional, for deployment)

### Environment Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd interlink
   npm install
   ```

2. **Environment variables:**
   Copy `.env.example` to `.env.local` and configure:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Better Auth Configuration  
   BETTER_AUTH_SECRET=your_auth_secret_key
   BETTER_AUTH_URL=http://localhost:3000

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Database setup:**
   - Create a new Supabase project
   - Run the SQL schema from `database/schema.sql` in Supabase SQL editor
   - Enable RLS on the `cards` table

4. **Run development server:**
   ```bash
   npm run dev
   ```

### Deployment to Vercel

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Configure environment variables in Vercel dashboard:**
   - Add all environment variables from `.env.local`
   - Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Vercel domain

3. **Update JavaScript snippet URLs:**
   - Update `INTERLINK_CONFIG.apiBaseUrl` in `public/js/interlink.js`
   - Regenerate minified version

## Usage Guide

### Admin Dashboard

1. **Access the dashboard:**
   - Navigate to `/login`
   - Create an account or sign in
   - Access dashboard at `/dashboard`

2. **Managing cards:**
   - **Add new card**: Click "Add Card" button
   - **Edit card**: Click edit icon on any card
   - **Toggle status**: Use "Activate/Deactivate" buttons
   - **Delete card**: Click trash icon (with confirmation)

3. **Card fields:**
   - **Key**: Unique identifier (e.g., `ChaseSapphirePreferred`)
   - **Display Name**: User-facing card name (e.g., `Chase Sapphire Preferred`)
   - **Terms URL**: Link to official terms and conditions
   - **Status**: `active` or `inactive`

### JavaScript Snippet Integration

1. **Include the script:**
   ```html
   <script src="https://your-domain.vercel.app/js/interlink.min.js" 
           data-user-id="YOUR_USER_ID" 
           defer></script>
   ```

2. **Use placeholders in content:**
   ```html
   <!-- Basic usage -->
   The {{Card:ChaseSapphirePreferred}} offers great rewards.
   
   <!-- Custom display text -->
   Check out this {{Card:ChaseSapphirePreferred|custom=amazing travel card}}.
   ```

3. **Configuration options:**
   - `data-user-id`: Your unique user ID (required)
   - `data-replace-all`: Set to "false" to replace only first occurrence

### API Endpoints

#### Private Endpoints (Authentication Required)

- `GET /api/cards` - Fetch user's cards
- `POST /api/cards` - Create new card
- `PATCH /api/cards/[id]` - Update card
- `DELETE /api/cards/[id]` - Delete card

#### Public Endpoints

- `GET /api/public/cards/[userId]` - Fetch active cards for user

## Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks

# Database
npm run db:generate-types  # Generate TypeScript types from Supabase
```

## File Structure

```
interlink/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts    # Better Auth handler
│   │   │   ├── cards/route.ts            # Cards CRUD API
│   │   │   ├── cards/[id]/route.ts       # Individual card API
│   │   │   └── public/cards/[userId]/route.ts  # Public cards API
│   │   ├── dashboard/page.tsx            # Admin dashboard
│   │   ├── login/page.tsx               # Login page
│   │   └── page.tsx                     # Root redirect
│   ├── components/
│   │   ├── ui/                          # shadcn/ui components
│   │   └── dashboard/                   # Dashboard components
│   └── lib/
│       ├── auth.ts                      # Better Auth config
│       ├── auth-client.ts               # Client-side auth
│       ├── supabase.ts                  # Supabase clients
│       ├── types.ts                     # TypeScript types
│       └── utils.ts                     # Utility functions
├── public/
│   ├── js/
│   │   ├── interlink.js                 # JavaScript snippet
│   │   └── interlink.min.js             # Minified version
│   └── example.html                     # Usage example
├── database/
│   └── schema.sql                       # Database schema
├── vercel.json                          # Vercel configuration
└── package.json                         # Dependencies and scripts
```

## Security Considerations

- **Row Level Security**: Database enforces user-scoped access
- **CORS Configuration**: Public API allows cross-origin requests
- **Input Sanitization**: HTML escaping prevents XSS attacks
- **Environment Variables**: Sensitive data stored securely
- **Authentication**: Better Auth handles secure session management

## Performance Optimizations

- **Caching**: API responses cached for 5 minutes
- **Minification**: JavaScript snippet minified for production
- **CDN**: Static assets served via Vercel Edge Network
- **Local Storage**: Client-side caching reduces API calls
- **Lazy Loading**: DOM processing after page load

## Troubleshooting

### Common Issues

1. **Cards not loading in dashboard:**
   - Check Supabase connection
   - Verify environment variables
   - Check browser console for errors

2. **JavaScript snippet not working:**
   - Verify correct user ID in script tag
   - Check network tab for API calls
   - Ensure CORS headers are set

3. **Authentication issues:**
   - Verify Better Auth configuration
   - Check environment variables
   - Clear browser cookies and try again

### Debug Mode

Enable debug logging by adding to console:
```javascript
window.InterlinkDebug = true;
```

## API Reference

### Card Object Schema

```typescript
interface Card {
  id: string
  user_id: string
  key: string
  display_name: string
  terms_url: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}
```

### Public API Response

```json
[
  {
    "key": "ChaseSapphirePreferred",
    "display_name": "Chase Sapphire Preferred",
    "terms_url": "https://chase.com/terms/sapphire-preferred",
    "status": "active"
  }
]
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] JavaScript snippet URLs updated
- [ ] CORS headers configured
- [ ] SSL certificate active
- [ ] Performance monitoring enabled

## Future Enhancements

- Audit trails for card changes
- Bulk import/export functionality
- Analytics dashboard for replacement metrics
- Multi-language support
- Server-side rendering for SEO
- Integration with external card APIs
- Slack/email notifications for changes

## Support

For technical issues or questions, refer to:
- Project documentation in this file
- Component-level documentation in source files
- API endpoint documentation in route files