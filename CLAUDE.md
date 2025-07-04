# Interlink Project Documentation

## Overview

Interlink is a lightweight, centralized system designed to ensure compliant-friendly card references across Kudos' marketing content. It provides an internal dashboard to manage card names, terms URLs, and statuses, coupled with a JavaScript snippet that dynamically replaces defined placeholders on public-facing pages.

## Architecture

### Tech Stack
- **Frontend**: Next.js 15.3.4 (App Router) with TypeScript
- **Styling**: TailwindCSS 4.0 with shadcn/ui components
- **Authentication**: Better Auth 1.2.12 with Google OAuth
- **Database**: PostgreSQL (via Supabase) with raw SQL queries using node-postgres
- **Hosting**: Vercel with Edge Network for JavaScript CDN
- **UI Components**: Custom shadcn/ui components with Radix UI primitives

### Core Components

1. **Admin Dashboard** (`/dashboard`)
   - Secure login with Better Auth Google OAuth
   - Advanced data table with inline editing capabilities
   - Real-time status management and bulk operations
   - User-scoped data access with session management

2. **Database Architecture**
   - **Hybrid approach**: Better Auth tables + application tables in PostgreSQL
   - **User-scoped data**: All business logic scoped to authenticated users
   - **Foreign key relationships**: Proper data integrity with cascade deletes
   - **Performance optimized**: Comprehensive indexing and query optimization

3. **Public API** (`/api/public/links/[userId]`)
   - Read-only access to active links only
   - CORS-enabled for cross-origin requests
   - Cached responses (5 minutes) with proper headers
   - XSS protection with HTML escaping

4. **JavaScript Snippet** (`/js/interlink.min.js`)
   - Lightweight (<5kb minified) with sophisticated caching
   - Client-side placeholder replacement with regex parsing
   - Local storage caching (5-minute TTL)
   - Graceful fallback handling and error recovery

## Database Architecture

### Schema Design

The system uses a **dual-database architecture** with Better Auth handling authentication through direct PostgreSQL connections while maintaining Supabase availability for additional features.

#### Better Auth Tables
```sql
-- Core user authentication
CREATE TABLE "user" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session management
CREATE TABLE session (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    token TEXT UNIQUE NOT NULL,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    expiresAt TIMESTAMPTZ NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Application Tables
```sql
-- Main business entity (evolved from "cards" concept)
CREATE TABLE links (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    displayName TEXT NOT NULL,
    url TEXT,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure key uniqueness per user
    UNIQUE(userId, key)
);
```

### Database Security

#### Application-Level Security
- **Session-based authentication**: All protected endpoints validate Better Auth sessions
- **User-scoped queries**: All business data filtered by `session.user.id`
- **Foreign key constraints**: Ensure data integrity with CASCADE deletes
- **Input validation**: Parameterized queries prevent SQL injection

#### Performance Optimizations
- **Strategic indexing**: User ID, status, and key fields indexed for performance
- **Connection pooling**: PostgreSQL connection pool for efficient resource usage
- **Query optimization**: Efficient queries with proper WHERE clauses
- **Automatic timestamps**: Triggers maintain consistent `updatedAt` timestamps

## API Design Patterns

### RESTful Architecture
```
GET    /api/links           # Fetch user's links
POST   /api/links           # Create new link
PATCH  /api/links/[id]      # Update link (dynamic fields)
DELETE /api/links/[id]      # Delete link
GET    /api/public/links/[userId] # Public API (active links only)
```

### Authentication Patterns
```typescript
// Consistent authentication check across all protected routes
const session = await auth.api.getSession({ headers: request.headers })
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

// User-scoped database operations
const { rows } = await db.query(
  'SELECT * FROM links WHERE "userId" = $1',
  [session.user.id]
)
```

### Error Handling
- **Structured error responses**: Consistent HTTP status codes and error messages
- **Specific error handling**: Unique constraint violations, foreign key errors
- **Security-conscious**: Generic error messages prevent information leakage
- **Graceful degradation**: Fallback handling for network and cache failures

## Frontend Architecture

### Component Architecture
```
SidebarLayout (authentication wrapper)
├── LinksDataTableNew (advanced table with inline editing)
│   ├── EditableCell (self-contained editing logic)
│   ├── Search and filtering capabilities
│   └── DropdownMenu (bulk actions per row)
├── Dialog (modal forms for creating links)
└── CTA (landing page call-to-action)
```

### State Management Strategy
- **Local component state**: React `useState` for component-specific data
- **No global state**: Simplified architecture without Redux/Zustand
- **Server state**: Fetch-based with manual cache invalidation
- **Form state**: Controlled components with validation

### Recent Architectural Improvements

#### Inline Editing Refactor (Option 3 Complete Implementation)
**Previous Issues**:
- Document-level event listeners causing performance problems
- Complex state synchronization between cells
- Timing issues with focus management
- Event conflicts and circular dependencies

**New Implementation**:
- **Self-contained EditableCell**: Each cell manages its own editing state
- **React-native event handling**: Uses `onBlur` with `relatedTarget` checks
- **Simplified focus management**: No document-level event listeners
- **Performance optimized**: Eliminates global event handlers

```typescript
// Key improvement: Self-contained editing logic
function EditableCell({ link, field, value, onUpdate }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  
  const handleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement
    if (relatedTarget?.hasAttribute('data-editable-trigger')) {
      handleSave() // Save and let other cell handle its edit
    } else {
      handleSave() // Save and exit editing
    }
  }
  
  // ... keyboard handling (Enter/Escape) and UI rendering
}
```

**Benefits**:
- **Reliability**: No more editing exits after typing one character
- **Performance**: Eliminated global event listeners
- **Maintainability**: Clean, self-contained component logic
- **User Experience**: Smooth transitions between editing cells

## JavaScript Snippet Implementation

### Public API Integration
```javascript
// Configuration (requires fixing for production)
const INTERLINK_CONFIG = {
  apiBaseUrl: 'https://your-domain.vercel.app/api/public/links', // ⚠️ NEEDS UPDATE
  cacheKey: 'interlink-cards-cache',
  cacheExpiry: 5 * 60 * 1000 // 5 minutes
}
```

### Content Replacement Mechanism
- **Placeholder patterns**: `{{key}}` and `{{key|custom=Custom Text}}`
- **Regex processing**: `/\{\{([^}|]+)(\|custom=([^}]+))?\}\}/g`
- **DOM traversal**: Safely processes text nodes while preserving structure
- **Link generation**: Creates proper `<a>` tags with `target="_blank"` and `rel="nofollow"`

### Caching Strategy
- **Multi-layer caching**: LocalStorage (5 min) + HTTP headers (5 min)
- **Per-user caching**: Separate cache keys for different users
- **Promise deduplication**: Prevents multiple simultaneous API calls
- **Graceful degradation**: Continues working if caching fails

## Security Implementation

### XSS Prevention
- **HTML escaping**: All user content escaped using `textContent`
- **Controlled HTML generation**: Only specific, sanitized HTML structures
- **No dynamic code execution**: No `eval()` or similar dangerous operations
- **Input validation**: Server-side validation with proper sanitization

### CORS Security
- **Explicit CORS headers**: `Access-Control-Allow-Origin: *` for public API
- **Preflight handling**: OPTIONS requests properly handled
- **Method restrictions**: Only GET allowed for public endpoints
- **Data filtering**: Only active links exposed, sensitive fields excluded

### Authentication Security
- **Session-based**: 7-day sessions with 1-day refresh cycle
- **Google OAuth only**: Simplified authentication flow
- **Secure cookies**: HTTP-only cookies with proper flags
- **Route protection**: Client-side and server-side session validation

## Performance Optimizations

### Database Performance
- **Indexing strategy**: User ID, status, and key fields indexed
- **Query optimization**: Efficient WHERE clauses and parameterized queries
- **Connection pooling**: PostgreSQL pool for resource management
- **Selective queries**: Only fetch required fields for public API

### Frontend Performance
- **Lazy loading**: JavaScript snippet waits for DOM ready
- **Efficient DOM manipulation**: Minimal text node replacement
- **Component optimization**: Self-contained components reduce re-renders
- **Caching**: Multiple cache layers for optimal performance

### CDN and Caching
- **Vercel Edge Network**: JavaScript snippet served from CDN
- **HTTP caching**: 5-minute cache headers for public API
- **Client-side caching**: LocalStorage with automatic expiration
- **Minification**: JavaScript snippet minified for production

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL database (via Supabase or direct)
- Vercel account (optional, for deployment)
- Google OAuth credentials

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
   # Database Configuration
   DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
   
   # Better Auth Configuration  
   BETTER_AUTH_SECRET=your_256_bit_secret_key
   BETTER_AUTH_URL=http://localhost:3000
   BETTER_AUTH_GOOGLE_CLIENT_ID=your_google_client_id
   BETTER_AUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # Supabase (optional, for additional features)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

3. **Database setup:**
   - Create a new PostgreSQL database
   - Run the SQL schema from `database/better-auth-schema.sql`
   - Ensure proper user permissions and connection settings

4. **Google OAuth setup:**
   - Create project in Google Cloud Console
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs

5. **Run development server:**
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
   - Update to match your deployment URL: `https://your-domain.vercel.app/api/public/links`
   - Regenerate minified version

## Usage Guide

### Admin Dashboard

1. **Access the dashboard:**
   - Navigate to `/login`
   - Sign in with Google OAuth
   - Access dashboard at `/dashboard`

2. **Managing links:**
   - **Add new link**: Click "Create link" button
   - **Inline edit**: Double-click any cell to edit in place
   - **Status toggle**: Click status badge to toggle active/inactive
   - **Delete link**: Use dropdown menu with confirmation

3. **Inline editing features:**
   - **Double-click to edit**: Enter edit mode immediately
   - **Continuous typing**: Type without interruption
   - **Save options**: Press Enter or click outside to save
   - **Cancel**: Press Escape to cancel changes
   - **Cell switching**: Click another cell to save current and edit new

4. **Link fields:**
   - **Key**: Unique identifier per user (e.g., `ChaseSapphirePreferred`)
   - **Display Name**: User-facing text (e.g., `Chase Sapphire Preferred`)
   - **URL**: Optional hyperlink for the card
   - **Status**: `active` (public) or `inactive` (hidden)

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
   The {{ChaseSapphirePreferred}} offers great rewards.
   
   <!-- Custom display text -->
   Check out this {{ChaseSapphirePreferred|custom=amazing travel card}}.
   
   <!-- Multiple placeholders -->
   Compare {{ChaseSapphirePreferred}} vs {{AmexGold|custom=Amex Gold Card}}.
   ```

3. **Configuration options:**
   - `data-user-id`: Your unique user ID (required)
   - `data-replace-all`: Set to "false" to replace only first occurrence

### API Endpoints

#### Private Endpoints (Authentication Required)

- `GET /api/links` - Fetch user's links
- `POST /api/links` - Create new link
- `PATCH /api/links/[id]` - Update link (supports dynamic field updates)
- `DELETE /api/links/[id]` - Delete link
- `GET /api/health/db` - Database health check

#### Public Endpoints

- `GET /api/public/links/[userId]` - Fetch active links for user
- `OPTIONS /api/public/links/[userId]` - CORS preflight

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
npm run db:generate-types  # Generate TypeScript types from Supabase (if used)
```

## File Structure

```
interlink/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts      # Better Auth handler
│   │   │   ├── links/route.ts              # Links CRUD API
│   │   │   ├── links/[id]/route.ts         # Individual link API
│   │   │   ├── public/links/[userId]/route.ts # Public links API
│   │   │   └── health/db/route.ts          # Database health check
│   │   ├── dashboard/page.tsx              # Admin dashboard
│   │   ├── links/page.tsx                  # Links management page
│   │   ├── login/page.tsx                  # Login page
│   │   └── page.tsx                        # Landing page
│   ├── components/
│   │   ├── ui/                             # shadcn/ui components
│   │   ├── dashboard/                      # Dashboard components
│   │   └── data-table/                     # Table components
│   └── lib/
│       ├── auth.ts                         # Better Auth config
│       ├── auth-client.ts                  # Client-side auth
│       ├── database.ts                     # Database connection
│       ├── types.ts                        # TypeScript types
│       └── utils.ts                        # Utility functions
├── public/
│   ├── js/
│   │   ├── interlink.js                    # JavaScript snippet
│   │   └── interlink.min.js                # Minified version
│   └── example.html                        # Usage example
├── database/
│   ├── better-auth-schema.sql              # Current schema
│   ├── schema.sql                          # Deprecated schema
│   └── better-auth-official-schema.sql     # Reference schema
├── vercel.json                             # Vercel configuration
└── package.json                            # Dependencies and scripts
```

## Security Considerations

- **Authentication**: Better Auth with Google OAuth provides secure session management
- **Database Security**: User-scoped queries prevent data leakage
- **XSS Prevention**: HTML escaping and controlled content generation
- **CORS Configuration**: Properly configured for public API access
- **Input Validation**: Server-side validation with parameterized queries
- **Session Management**: Secure cookies with proper expiration

## Performance Optimizations

- **Database**: Comprehensive indexing and query optimization
- **Caching**: Multi-layer caching strategy (client + server + CDN)
- **Minification**: JavaScript snippet optimized for production
- **CDN**: Static assets served via Vercel Edge Network
- **Component Architecture**: Self-contained components reduce re-renders
- **Lazy Loading**: Non-critical JavaScript loaded after DOM ready

## Critical Issues and Recommendations

### Production Readiness Issues

1. **JavaScript Snippet Configuration** (High Priority)
   - **Issue**: `INTERLINK_CONFIG.apiBaseUrl` doesn't match actual API structure
   - **Current**: `https://your-domain.vercel.app/api/public/links`
   - **Required**: `https://your-domain.vercel.app/api/public/links/[userId]`
   - **Action**: Update configuration and regenerate minified version

2. **Environment Configuration**
   - **Issue**: Placeholder domains in configuration
   - **Action**: Update all URLs to match actual deployment domain

### Recommended Enhancements

1. **Error Reporting**: Add optional error reporting for production debugging
2. **Real-time Updates**: Consider WebSocket or polling for live data updates
3. **Form Validation**: Client-side validation for better user experience
4. **Loading States**: More sophisticated loading indicators
5. **Audit Trails**: Consider adding audit logging for link changes

## Troubleshooting

### Common Issues

1. **Links not loading in dashboard:**
   - Check database connection and environment variables
   - Verify Better Auth configuration
   - Check browser console for authentication errors

2. **JavaScript snippet not working:**
   - Verify correct user ID in script tag
   - Check network tab for API call failures
   - Ensure CORS headers are properly set
   - Verify API endpoint configuration

3. **Authentication issues:**
   - Check Google OAuth credentials and redirect URIs
   - Verify Better Auth environment variables
   - Clear browser cookies and try again

4. **Database connectivity:**
   - Use `/api/health/db` endpoint to check database status
   - Verify DATABASE_URL format and permissions
   - Check PostgreSQL connection limits

### Debug Mode

Enable debug logging by adding to browser console:
```javascript
window.InterlinkDebug = true;
```

## API Reference

### Link Object Schema

```typescript
interface Link {
  id: string
  userId: string
  key: string
  displayName: string
  url: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

interface PublicLink {
  key: string
  displayName: string
  url: string | null
  status: 'active'
}
```

### Public API Response

```json
[
  {
    "key": "ChaseSapphirePreferred",
    "displayName": "Chase Sapphire Preferred",
    "url": "https://chase.com/sapphire-preferred",
    "status": "active"
  }
]
```

## Deployment Checklist

- [ ] Environment variables configured in Vercel
- [ ] Database schema deployed to PostgreSQL
- [ ] Google OAuth credentials configured
- [ ] JavaScript snippet URLs updated for production
- [ ] CORS headers configured for public API
- [ ] SSL certificate active
- [ ] Database health check endpoint working
- [ ] Performance monitoring enabled
- [ ] Error logging configured

## Future Enhancements

### Planned Features
- **Audit trails**: Track changes to links with timestamps and user info
- **Bulk operations**: Import/export functionality for link management
- **Analytics dashboard**: Usage metrics for link replacements
- **Multi-language support**: Internationalization for global usage
- **Real-time collaboration**: Multiple users editing simultaneously
- **Advanced caching**: Redis caching layer for high-traffic scenarios

### Integration Opportunities
- **External APIs**: Integration with card provider APIs for real-time data
- **Notifications**: Slack/email notifications for link changes
- **Version control**: Git-like versioning for link content
- **A/B testing**: Support for testing different link variations
- **SEO optimization**: Server-side rendering for better search indexing

### Scalability Considerations
- **Database sharding**: User-based sharding for larger datasets
- **API rate limiting**: Implement rate limiting for public API
- **CDN optimization**: Geographic distribution for global performance
- **Microservices**: Consider breaking into smaller services as needed

## Support and Maintenance

### Documentation
- **CLAUDE.md**: This comprehensive architecture guide
- **Component documentation**: Inline documentation in React components
- **API documentation**: OpenAPI specification for all endpoints
- **Database schema**: Comprehensive schema documentation

### Monitoring
- **Health checks**: Database and API health monitoring
- **Error tracking**: Comprehensive error logging and alerting
- **Performance metrics**: Response time and throughput monitoring
- **Usage analytics**: Track feature usage and user behavior

### Contributing
- **Code standards**: TypeScript, ESLint, and Prettier configuration
- **Testing**: Component and API endpoint testing
- **Documentation**: Keep CLAUDE.md updated with architectural changes
- **Security**: Regular security audits and dependency updates

---

*This documentation reflects the current state of the Interlink project as of the comprehensive architecture analysis. Keep this document updated as the project evolves.*