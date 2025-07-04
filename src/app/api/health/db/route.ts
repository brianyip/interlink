import { NextResponse } from "next/server"
import { Pool } from "pg"

export async function GET() {
  let client;
  
  try {
    // Test database connection with the same configuration as Better Auth
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      query_timeout: 10000,
      ssl: {
        rejectUnauthorized: false,
      },
    })

    // Test connection and query
    const startTime = Date.now()
    client = await pool.connect()
    const connectionTime = Date.now() - startTime

    // Test a simple query
    const queryStartTime = Date.now()
    const result = await client.query('SELECT NOW() as current_time, version() as db_version')
    const queryTime = Date.now() - queryStartTime

    // Test Better Auth tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user', 'session', 'account', 'verification', 'links')
      ORDER BY table_name
    `)

    const response = {
      status: "healthy",
      database: {
        connected: true,
        connectionTime: `${connectionTime}ms`,
        queryTime: `${queryTime}ms`,
        currentTime: result.rows[0].current_time,
        version: result.rows[0].db_version.split(' ')[0], // First part of version
      },
      betterAuth: {
        tablesFound: tablesResult.rows.map(row => row.table_name),
        tablesCount: tablesResult.rows.length,
        expectedTables: ['account', 'links', 'session', 'user', 'verification'],
        allTablesExist: tablesResult.rows.length === 5,
      },
      environment: {
        databaseUrl: process.env.DATABASE_URL ? "✓ Set" : "✗ Missing",
        googleClientId: process.env.GOOGLE_CLIENT_ID ? "✓ Set" : "✗ Missing",
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? "✓ Set" : "✗ Missing",
      }
    }

    await pool.end()
    
    return NextResponse.json(response, { status: 200 })

  } catch (error: unknown) {
    console.error("Database health check failed:", error)
    
    const errorInfo = error as { message?: string; code?: string; name?: string; detail?: string }
    const response = {
      status: "unhealthy",
      error: {
        message: errorInfo.message || "Unknown error",
        code: errorInfo.code || "UNKNOWN",
        name: errorInfo.name || "Error",
        detail: errorInfo.detail || null,
      },
      environment: {
        databaseUrl: process.env.DATABASE_URL ? "✓ Set" : "✗ Missing",
        googleClientId: process.env.GOOGLE_CLIENT_ID ? "✓ Set" : "✗ Missing",
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? "✓ Set" : "✗ Missing",
      }
    }
    
    return NextResponse.json(response, { status: 500 })
  } finally {
    if (client) {
      client.release()
    }
  }
}