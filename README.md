# Interlink

A lightweight, centralized system for compliant-friendly card references across marketing content.

## Quick Start

1. **Setup:**
   ```bash
   npm install
   cp .env.example .env.local
   # Configure environment variables
   ```

2. **Database:**
   - Create Supabase project
   - Run `database/schema.sql`

3. **Development:**
   ```bash
   npm run dev
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

## Features

- 🔐 Secure admin dashboard with Better Auth
- 📊 CRUD operations for card management
- 🌐 Public API for active cards
- ⚡ Lightweight JavaScript snippet for dynamic replacement
- 🚀 Vercel deployment ready
- 🔒 Row Level Security with Supabase

## Usage

### Admin Dashboard
Visit `/dashboard` to manage card references with full CRUD operations.

### JavaScript Integration
```html
<script src="https://your-domain.vercel.app/js/interlink.min.js" 
        data-user-id="YOUR_USER_ID" defer></script>
```

### Content Placeholders
```html
The {{Card:ChaseSapphirePreferred}} offers great rewards.
Custom text: {{Card:AmexGold|custom=premium dining card}}
```

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation including:
- Detailed setup instructions
- API reference
- Deployment guide
- Troubleshooting
- Architecture overview

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui
- Supabase (Database + Auth)
- Better Auth
- Vercel (Hosting)

## License

Private - Proprietary to Kudos
