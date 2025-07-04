import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: {
    rejectUnauthorized: false,
  },
})

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  end: () => pool.end(),
}

export default db