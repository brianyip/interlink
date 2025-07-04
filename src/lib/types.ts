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