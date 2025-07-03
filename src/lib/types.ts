export interface Card {
  id: string
  user_id: string
  key: string
  display_name: string
  terms_url: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface CardCreateInput {
  key: string
  display_name: string
  terms_url: string
  status?: 'active' | 'inactive'
}

export interface CardUpdateInput {
  key?: string
  display_name?: string
  terms_url?: string
  status?: 'active' | 'inactive'
}

export interface PublicCard {
  key: string
  display_name: string
  terms_url: string
  status: 'active'
}