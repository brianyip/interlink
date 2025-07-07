# Content Chat Feature - Product Requirements Document

## 1. Overview

**Content Chat** is an AI-powered conversational interface integrated into Interlink that enables users to query, analyze, and bulk-edit content from their Webflow-hosted blogs and websites. The feature leverages vector search with pgvector, OpenAI embeddings, and natural language processing to provide instant access to content insights and editing capabilities without leaving the Interlink dashboard.

This feature extends Interlink's core value proposition of managing compliant card references by adding intelligent content discovery and management capabilities for marketing teams managing large content libraries in Webflow.

## 2. Objectives & Success Metrics

### Primary Objectives
- **Reduce content audit time** by 75% through conversational search
- **Enable bulk content updates** across multiple posts in seconds
- **Improve compliance accuracy** by identifying all card/term references
- **Provide instant content insights** without manual searching

### Success Metrics
- **Performance**: 95th-percentile vector search < 300ms
- **Accuracy**: ≥ 95% correct matches for term-presence queries
- **Adoption**: ≥ 50% of active users execute at least one chat query within first month
- **Cost Efficiency**: ≥ 90% of queries served via vector search (no LLM API calls)
- **User Satisfaction**: NPS score ≥ 8 for Content Chat feature

## 3. User Stories

### Primary User Stories

1. **Operations Manager**
   - "As an ops manager, I want to find every mention of a specific card name across all our content so I can ensure compliance with updated terms."
   - "As an ops manager, I need to verify that all card references use the correct legal terminology before our quarterly compliance review."

2. **Content Editor**
   - "As a content editor, I want to replace outdated card names or terminology across all blog posts with a single command."
   - "As a content editor, I need to find all posts that mention competitor cards so I can update our comparative content."

3. **SEO Specialist**
   - "As an SEO specialist, I want to discover which posts cover specific topics or keywords to guide our content strategy."
   - "As an SEO specialist, I need to find content gaps by querying what topics we haven't covered."

4. **Marketing Manager**
   - "As a marketing manager, I want to quickly audit our content for brand consistency across all card mentions."
   - "As a marketing manager, I need to update promotional offers across multiple posts when card benefits change."

## 4. Functional Requirements

### 4.1 Webflow Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FC1 | **OAuth Connection**: Implement Webflow OAuth flow with secure token storage in PostgreSQL (encrypted per user) | P0 |
| FC2 | **Collection Discovery**: Auto-detect and list all CMS collections after connection | P0 |
| FC3 | **Content Ingestion**: Fetch all items from selected collections via Webflow CMS API with pagination support | P0 |
| FC4 | **Incremental Sync**: Support webhook-based or scheduled updates for changed content | P1 |
| FC5 | **Rate Limit Handling**: Implement exponential backoff and queue system for Webflow API limits | P0 |

### 4.2 Content Processing & Storage

| ID | Requirement | Priority |
|----|-------------|----------|
| FP1 | **Content Chunking**: Split long posts into ~500-word semantic chunks preserving context | P0 |
| FP2 | **Embedding Generation**: Generate OpenAI embeddings for each chunk | P0 |
| FP3 | **Metadata Extraction**: Extract card names, URLs, dates using lightweight NER | P1 |
| FP4 | **Vector Storage**: Store embeddings in PostgreSQL with pgvector extension | P0 |
| FP5 | **User Isolation**: Ensure all content is strictly scoped to authenticated user | P0 |

### 4.3 Chat Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| FU1 | **Chat UI**: Persistent chat window with message history in dashboard | P0 |
| FU2 | **Natural Language Input**: Support queries like "Which posts mention Chase Sapphire?" | P0 |
| FU3 | **Context Preservation**: Maintain conversation context for follow-up questions | P1 |
| FU4 | **Quick Actions**: Predefined query templates for common tasks | P2 |
| FU5 | **Export Results**: Download search results as CSV/JSON | P2 |

### 4.4 Search & Discovery

| ID | Requirement | Priority |
|----|-------------|----------|
| FS1 | **Vector Search**: Semantic search using pgvector similarity | P0 |
| FS2 | **Result Display**: Show post title, URL, matched snippet with highlighting | P0 |
| FS3 | **Result Actions**: "Open in Editor", "View in Webflow", "Preview" buttons | P0 |
| FS4 | **Relevance Scoring**: Display similarity scores and sort by relevance | P1 |
| FS5 | **Search Refinement**: Filter by date, collection, or metadata | P2 |

### 4.5 Content Editing

| ID | Requirement | Priority |
|----|-------------|----------|
| FE1 | **Inline Preview**: Show content with proposed changes highlighted | P0 |
| FE2 | **Bulk Replace**: Execute find-and-replace across multiple posts | P0 |
| FE3 | **Change Confirmation**: Preview all changes before applying | P0 |
| FE4 | **Undo Support**: Revert recent changes within session | P1 |
| FE5 | **Audit Trail**: Log all content changes with timestamps | P1 |

### 4.6 Post Editor

| ID | Requirement | Priority |
|----|-------------|----------|
| FD1 | **Rich Editor**: Full-featured editor at `/dashboard/content-chat/post/[postId]` | P0 |
| FD2 | **Auto-scroll**: Jump to matched terms with highlighting | P0 |
| FD3 | **Save Integration**: Direct save to Webflow via API | P0 |
| FD4 | **Version Comparison**: Show diff between original and edited | P1 |
| FD5 | **Collaborative Notes**: Add internal notes not published to Webflow | P2 |

## 5. Technical Architecture

### 5.1 Technology Stack Integration

Building on Interlink's existing stack:
- **Frontend**: Next.js 15.3.4 App Router with TypeScript
- **UI Components**: shadcn/ui components following existing patterns
- **Authentication**: Better Auth with session-based user isolation
- **Database**: PostgreSQL with pgvector extension
- **Vector Search**: pgvector with OpenAI embeddings
- **External APIs**: Webflow CMS API, OpenAI API
- **Deployment**: Vercel with Edge Functions

### 5.2 Database Schema

Following Interlink's schema patterns:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- User settings for API keys
CREATE TABLE user_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    webflowApiKey TEXT, -- Encrypted
    openaiApiKey TEXT, -- Encrypted
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(userId)
);

-- Webflow content storage
CREATE TABLE webflow_content (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    webflowItemId TEXT NOT NULL,
    collectionId TEXT NOT NULL,
    collectionName TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    fullContent TEXT,
    publishedDate TIMESTAMPTZ,
    lastSyncedAt TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(userId, webflowItemId)
);

-- Content chunks with embeddings
CREATE TABLE content_chunks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    contentId TEXT NOT NULL REFERENCES webflow_content(id) ON DELETE CASCADE,
    chunkIndex INTEGER NOT NULL,
    chunkText TEXT NOT NULL,
    embedding vector(1536), -- OpenAI ada-002 dimensions
    metadata JSONB,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(contentId, chunkIndex)
);

-- Chat conversations
CREATE TABLE chat_conversations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    title TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    conversationId TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB, -- Store search results, matched content IDs, etc.
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_webflow_content_user_id ON webflow_content(userId);
CREATE INDEX idx_content_chunks_user_id ON content_chunks(userId);
CREATE INDEX idx_content_chunks_embedding ON content_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversationId, createdAt);

-- Add updated_at triggers
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webflow_content_updated_at BEFORE UPDATE ON webflow_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_chunks_updated_at BEFORE UPDATE ON content_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 5.3 API Architecture

Following Interlink's RESTful patterns:

#### Webflow Integration APIs
```
POST   /api/webflow/connect         # Initialize OAuth flow
GET    /api/webflow/callback        # OAuth callback handler
GET    /api/webflow/collections     # List user's collections
POST   /api/webflow/sync           # Trigger content sync
GET    /api/webflow/sync/status    # Check sync progress
```

#### Chat APIs
```
GET    /api/chat/conversations      # List user's conversations
POST   /api/chat/conversations      # Create new conversation
GET    /api/chat/messages/[conversationId]  # Get messages
POST   /api/chat/messages           # Send message (triggers search)
DELETE /api/chat/conversations/[id] # Delete conversation
```

#### Content Management APIs
```
GET    /api/content/search          # Vector search endpoint
GET    /api/content/[id]           # Get specific content
PATCH  /api/content/[id]           # Update content (syncs to Webflow)
POST   /api/content/bulk-update    # Bulk find-and-replace
```

### 5.4 Implementation Architecture

#### Component Structure
```
/src/app/chat/page.tsx                    # Main chat page
/src/app/chat/post/[postId]/page.tsx     # Post editor page

/src/components/dashboard/
  ├── content-chat.tsx                    # Main chat component
  ├── chat-message.tsx                    # Individual message component
  ├── chat-input.tsx                      # Input with quick actions
  ├── search-results.tsx                  # Search results display
  └── content-editor.tsx                  # Rich text editor

/src/lib/
  ├── webflow-client.ts                   # Webflow API client
  ├── openai-client.ts                    # OpenAI API client
  ├── vector-search.ts                    # pgvector search utilities
  └── content-processor.ts                # Chunking and processing
```

## 6. UI/UX Design

### 6.1 Information Architecture

Following Interlink's sidebar pattern:
```
Dashboard
├── Home
├── Links 
├── Content Chat (NEW)
│   ├── Chat Interface
│   ├── Post Editor
│   └── Settings
└── Settings
```

### 6.2 Chat Interface Design

Following existing UI patterns:

```typescript
// Main container following Interlink's white box pattern
<div className="bg-white border border-gray-200 rounded-lg overflow-hidden h-[calc(100vh-200px)]">
  {/* Chat header */}
  <div className="border-b border-gray-200 p-4">
    <h2 className="text-lg font-medium">Content Chat</h2>
    {/* Connection status indicator */}
  </div>
  
  {/* Messages area */}
  <div className="flex-1 overflow-y-auto p-4 space-y-4">
    {/* Message bubbles */}
  </div>
  
  {/* Input area */}
  <div className="border-t border-gray-200 p-4">
    {/* Input with send button */}
  </div>
</div>
```

### 6.3 Search Result Cards

```
┌─────────────────────────────────────────────┐
│ Best Travel Cards 2024                      │
│ /blog/best-travel-cards-2024                │
│                                             │
│ "...the Chase Sapphire Preferred offers..." │
│                                             │
│ [Open Editor] [View in Webflow] [Preview]   │
└─────────────────────────────────────────────┘
```

### 6.4 Interaction Patterns

1. **Connect Flow**: Modal dialog for Webflow OAuth
2. **Loading States**: Inline loading text following existing patterns
3. **Error Handling**: Toast notifications for errors
4. **Success Feedback**: Brief success messages in chat
5. **Keyboard Shortcuts**: Cmd+Enter to send, Esc to cancel

## 7. Security & Permissions

### 7.1 Authentication & Authorization

Following Interlink's security patterns:

1. **Session Validation**: Every endpoint validates Better Auth session
2. **User Isolation**: All queries include `userId` filter
3. **API Key Encryption**: Store encrypted API keys in database
4. **CORS**: Only enabled for specific Webflow callbacks

### 7.2 Data Security

1. **SQL Injection Prevention**: Parameterized queries throughout
2. **XSS Protection**: HTML escaping for all user content
3. **Rate Limiting**: Implement per-user rate limits
4. **Audit Logging**: Track all content modifications

### 7.3 API Security

```typescript
// Standard security pattern for all endpoints
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  // Validate input
  const body = await request.json()
  const validated = schema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }
  
  // User-scoped operations only
  const result = await db.query(
    'SELECT * FROM content WHERE userId = $1',
    [session.user.id]
  )
}
```

## 8. Performance Requirements

### 8.1 Response Time Targets

- **Vector Search**: < 300ms (p95)
- **Content Sync**: < 30s for 100 posts
- **UI Responsiveness**: < 100ms for user actions
- **Message Send**: < 500ms including search

### 8.2 Scalability Targets

- **Content Volume**: Support up to 10,000 posts per user
- **Concurrent Users**: Handle 100 concurrent chat sessions
- **Message History**: Store up to 1,000 messages per user
- **Search Results**: Return up to 50 results per query

### 8.3 Optimization Strategies

1. **Caching**: 5-minute cache for vector search results
2. **Pagination**: Limit initial results to 10, load more on demand
3. **Lazy Loading**: Load message history as user scrolls
4. **Connection Pooling**: Reuse database connections
5. **Edge Functions**: Use Vercel Edge for low-latency responses

## 9. Error Handling & Recovery

### 9.1 User-Facing Errors

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Webflow API Error | "Unable to connect to Webflow. Please try again." | Retry with exponential backoff |
| Search Timeout | "Search is taking longer than expected..." | Show partial results |
| Save Conflict | "This content was modified elsewhere. Review changes?" | Show diff and merge options |
| Rate Limit | "Too many requests. Please wait a moment." | Queue and retry |

### 9.2 System Errors

- **Database Connection**: Automatic retry with circuit breaker
- **Embedding Generation**: Fallback to keyword search
- **Vector Search Failure**: Graceful degradation to text search

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema setup with pgvector
- [ ] Webflow OAuth integration
- [ ] Basic content ingestion pipeline
- [ ] Simple chat UI scaffold

### Phase 2: Core Features (Week 3-4)
- [ ] Vector search implementation
- [ ] Chat message handling
- [ ] Search result display
- [ ] Basic content editor

### Phase 3: Advanced Features (Week 5-6)
- [ ] Bulk find-and-replace
- [ ] Incremental sync
- [ ] Rich text editor
- [ ] Performance optimization

### Phase 4: Polish (Week 7-8)
- [ ] Error handling improvements
- [ ] UI/UX refinements
- [ ] Documentation
- [ ] Testing and QA

## 11. Testing Strategy

### 11.1 Unit Tests
- Vector search algorithms
- Content chunking logic
- API endpoint validation
- UI component behavior

### 11.2 Integration Tests
- End-to-end chat flow
- Webflow sync pipeline
- Content update workflow
- Authentication flow

### 11.3 Performance Tests
- Vector search under load
- Concurrent user scenarios
- Large content library handling
- API rate limit compliance

## 12. Analytics & Monitoring

### 12.1 Usage Metrics
- Daily active users
- Messages per user
- Search queries per session
- Content edits per week
- Feature adoption rate

### 12.2 Performance Metrics
- Search response times
- Sync completion rates
- Error rates by type
- API usage by endpoint

### 12.3 Business Metrics
- Time saved on content audits
- Compliance accuracy improvement
- User satisfaction scores

## 13. Future Enhancements

### 13.1 Near-term (3-6 months)
- Real-time collaborative editing
- Advanced NLP for intent recognition
- Custom embedding models
- Scheduled content syncs
- Mobile-responsive chat interface

### 13.2 Long-term (6-12 months)
- Multi-language support
- Voice input for queries
- AI-powered content suggestions
- Integration with other CMS platforms
- Advanced analytics dashboard

## 14. Next Steps & Implementation TODO

### Immediate Actions (Week 1)

1. **Database Setup**
   - [ ] Enable pgvector extension in Supabase
   - [ ] Create migration files for new schema
   - [ ] Add indexes for performance
   - [ ] Test vector operations locally

2. **API Key Management**
   - [ ] Design encryption strategy for API keys
   - [ ] Create settings UI for API key input
   - [ ] Implement secure storage/retrieval

3. **Webflow Integration**
   - [ ] Register OAuth application with Webflow
   - [ ] Implement OAuth flow handlers
   - [ ] Create Webflow API client library
   - [ ] Test connection and data fetching

### Core Development (Week 2-4)

4. **Content Processing Pipeline**
   - [ ] Implement content chunking algorithm
   - [ ] Integrate OpenAI embeddings API
   - [ ] Create background job for processing
   - [ ] Handle incremental updates

5. **Chat Interface**
   - [ ] Build chat UI component structure
   - [ ] Implement message state management
   - [ ] Create typing indicators and loading states
   - [ ] Add keyboard shortcuts

6. **Vector Search**
   - [ ] Implement pgvector similarity search
   - [ ] Create relevance scoring algorithm
   - [ ] Build search result components
   - [ ] Add highlighting for matched terms

### Feature Completion (Week 5-6)

7. **Content Editor**
   - [ ] Create post editor page
   - [ ] Implement rich text editing
   - [ ] Add change preview/diff view
   - [ ] Integrate Webflow save API

8. **Bulk Operations**
   - [ ] Design bulk replace UI/UX
   - [ ] Implement find-and-replace logic
   - [ ] Add confirmation dialogs
   - [ ] Create undo mechanism

9. **Performance Optimization**
   - [ ] Implement caching layer
   - [ ] Optimize vector search queries
   - [ ] Add pagination for large results
   - [ ] Profile and optimize slow paths

### Quality Assurance (Week 7-8)

10. **Testing**
    - [ ] Write unit tests for core logic
    - [ ] Create integration test suite
    - [ ] Perform load testing
    - [ ] User acceptance testing

11. **Documentation**
    - [ ] API documentation
    - [ ] User guide for Content Chat
    - [ ] Technical implementation notes
    - [ ] Update CLAUDE.md

12. **Deployment**
    - [ ] Configure production environment
    - [ ] Set up monitoring and alerts
    - [ ] Create rollback plan
    - [ ] Gradual rollout strategy

### Success Criteria for Launch

- [ ] All P0 requirements implemented and tested
- [ ] Performance metrics meet targets
- [ ] Security review completed
- [ ] Documentation complete
- [ ] Beta user feedback incorporated
- [ ] Monitoring and analytics in place

---

*This PRD represents the complete adaptation of the Content Chat feature to the Interlink architecture, maintaining consistency with existing patterns while introducing powerful new capabilities for content management.*