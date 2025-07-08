export interface Link {
  id: string
  userId: string
  key: string
  displayName: string
  url: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface LinkCreateInput {
  key: string
  displayName: string
  url?: string
  status?: 'active' | 'inactive'
}

export interface LinkUpdateInput {
  key?: string
  displayName?: string
  url?: string
  status?: 'active' | 'inactive'
}

export interface PublicLink {
  key: string
  displayName: string
  url: string | null
  status: 'active'
}

// =============================================================================
// CONTENT CHAT TYPES
// =============================================================================

// Webflow OAuth Connection (Updated for 365-day tokens)
export interface WebflowConnection {
  id: string
  userId: string
  accessToken: string // Encrypted AES-256
  refreshToken: string | null // Always null for Webflow (365-day tokens)
  expiresAt: string
  tokenCreatedAt: string | null // Webflow's created_at timestamp
  scope: string
  createdAt: string
  updatedAt: string
}

// Webflow Connection Status (API Response)
export interface WebflowConnectionStatus {
  connected: boolean
  configValid: boolean
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
  }
  tokenStatus?: {
    isExpired: boolean
    expiresAt: string
    minutesUntilExpiry: number
    needsRefresh: boolean
    scope: string
  }
  connection?: {
    createdAt: string
    updatedAt: string
    lastTested: string
  }
  sites: Array<{
    id: string
    name: string
    shortName: string
    lastPublished: string | null
    previewUrl: string | null
  }>
  stats: {
    sitesCount: number
    collectionsCount: number
    hasContent: boolean
  }
  actions?: {
    refreshUrl: string
    disconnectUrl: string
    syncUrl: string
  }
  error?: string
  details?: string
  needsReauth?: boolean
}

// Webflow Content Metadata
export interface WebflowContent {
  id: string
  userId: string
  collectionId: string
  itemId: string
  collectionName: string
  title: string
  slug: string
  lastPublished: string | null
  contentHash: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Content Chunk with Embeddings
export interface ContentChunk {
  id: string
  contentId: string
  userId: string
  chunkIndex: number
  content: string
  contentVector: number[] | null // 1536-dimensional vector
  tokens: number
  metadata: Record<string, unknown>
  createdAt: string
}

// Chat Conversation
export interface ChatConversation {
  id: string
  userId: string
  title: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Chat Message
export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'function'
  content: string | null
  functionCall: Record<string, unknown> | null
  metadata: Record<string, unknown>
  createdAt: string
}

// Content Operation (Audit Log)
export interface ContentOperation {
  id: string
  userId: string
  operationType: 'search' | 'update' | 'bulk_update' | 'export' | 'sync'
  affectedItems: string[] // Array of content IDs
  changes: Record<string, unknown> | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error: string | null
  startedAt: string
  completedAt: string | null
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

// Webflow OAuth
export interface WebflowAuthRequest {
  state?: string
  redirectUri?: string
}

export interface WebflowAuthCallback {
  code: string
  state?: string
}

// Content Search
export interface ContentSearchRequest {
  query: string
  filters?: {
    collectionId?: string
    dateRange?: {
      start: string
      end: string
    }
    limit?: number
    threshold?: number
  }
}

export interface ContentSearchResult {
  chunkId: string
  contentId: string
  content: string
  title: string
  slug: string
  similarity: number
  rank: number
}

export interface ContentSearchResponse {
  results: ContentSearchResult[]
  totalCount: number
  query: string
  executionTime: number
}

// Chat Messages
export interface ChatMessageRequest {
  conversationId: string
  message: string
  stream?: boolean
}

export interface ChatMessageResponse {
  id: string
  conversationId: string
  role: 'assistant'
  content: string
  functionCall?: Record<string, unknown>
  metadata: {
    matches?: ContentSearchResult[]
    tokenCount?: number
    executionTime?: number
  }
}

// Content Updates
export interface ContentUpdateRequest {
  contentId: string
  updates: {
    title?: string
    content?: string
    metadata?: Record<string, unknown>
  }
}

export interface BulkUpdateRequest {
  updates: Array<{
    contentId: string
    originalText: string
    replacementText: string
  }>
  preview?: boolean
}

export interface BulkUpdateResponse {
  operationId: string
  affectedCount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  changes?: Array<{
    contentId: string
    title: string
    changes: Array<{
      before: string
      after: string
      position: number
    }>
  }>
}

// Content Sync
export interface ContentSyncRequest {
  force?: boolean
  collectionIds?: string[]
}

export interface ContentSyncResponse {
  operationId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  stats: {
    collectionsProcessed: number
    itemsProcessed: number
    chunksCreated: number
    embeddingsGenerated: number
    errors: number
  }
}

// Internal content sync result type
export interface ContentSyncResult {
  success: boolean
  sitesProcessed: number
  collectionsProcessed: number
  itemsProcessed: number
  chunksCreated: number
  errors: string[]
  duration: number
  startedAt: string
  completedAt: string
}

// =============================================================================
// EMBEDDING & VECTOR TYPES
// =============================================================================

export interface EmbeddingRequest {
  texts: string[]
  model?: string // Default: text-embedding-3-small
}

export interface EmbeddingResponse {
  embeddings: number[][]
  usage: {
    promptTokens: number
    totalTokens: number
  }
  model: string
}

export interface VectorSearchOptions {
  limit?: number
  threshold?: number
  includeMetadata?: boolean
  userId: string
}

// =============================================================================
// WEBFLOW API TYPES
// =============================================================================

export interface WebflowCollection {
  _id: string
  name: string
  slug: string
  singularName: string
  lastUpdated: string
  createdOn: string
  fields: WebflowField[]
  // Legacy properties for compatibility
  id?: string
  displayName?: string
}

export interface WebflowField {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  editable: boolean
  validations?: Record<string, unknown>
}

export interface WebflowItem {
  _id: string
  _cid: string
  _archived: boolean
  _draft: boolean
  name: string
  slug: string
  'updated-on': string
  'created-on': string
  'updated-by': string
  'created-by': string
  'published-on'?: string | null
  'published-by'?: string | null
  // Legacy properties for compatibility
  id?: string
  lastPublished?: string
  lastUpdated?: string
  createdOn?: string
  isArchived?: boolean
  isDraft?: boolean
  fieldData?: Record<string, unknown>
}

export interface WebflowApiResponse<T> {
  items: T[]
  pagination?: {
    limit: number
    offset: number
    total: number
  }
}

// =============================================================================
// HEALTH CHECK TYPES
// =============================================================================

export interface ContentChatHealthCheck {
  status: 'healthy' | 'unhealthy' | 'error'
  timestamp: string
  checks: {
    pgvector_extension: boolean
    content_chat_tables: boolean
    vector_index: boolean
    hybrid_search_function: boolean
  }
  details?: {
    tables: {
      webflow_connections: boolean
      webflow_content: boolean
      content_chunks: boolean
      chat_conversations: boolean
      chat_messages: boolean
      content_operations: boolean
    }
  }
  error?: string
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface ApiError {
  error: string
  code?: string
  details?: Record<string, unknown>
}

export interface ValidationError {
  field: string
  message: string
  code: string
}