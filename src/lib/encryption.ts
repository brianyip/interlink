import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * AES-256-GCM encryption utility for securing OAuth tokens and sensitive data
 * 
 * Uses a 256-bit key derived from ENCRYPTION_KEY environment variable
 * Each encryption operation uses a unique IV for security
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM recommends 12 bytes
const TAG_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

/**
 * Get the encryption key from environment variable
 * Derives a consistent key using scrypt for cryptographic strength
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  
  if (envKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
  }
  
  // Use a fixed salt for key derivation to ensure consistency
  const salt = Buffer.from('interlink-content-chat-salt-2024', 'utf8')
  return scryptSync(envKey, salt, KEY_LENGTH)
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns base64-encoded string containing IV + encrypted data + auth tag
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    
    const cipher = createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    // Combine IV + encrypted data + tag and encode as base64
    const combined = Buffer.concat([
      iv,
      Buffer.from(encrypted, 'hex'),
      tag
    ])
    
    return combined.toString('base64')
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt a base64-encoded encrypted string
 * Expects format: IV + encrypted data + auth tag (all base64 encoded)
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedData, 'base64')
    
    // Extract components
    const iv = combined.slice(0, IV_LENGTH)
    const tag = combined.slice(-TAG_LENGTH)
    const encrypted = combined.slice(IV_LENGTH, -TAG_LENGTH)
    
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate a secure random encryption key for environment variable
 * Use this function to generate a new ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64')
}

/**
 * Validate that encryption/decryption is working correctly
 * Useful for testing configuration
 */
export function validateEncryption(): boolean {
  try {
    const testData = 'test-encryption-validation'
    const encrypted = encrypt(testData)
    const decrypted = decrypt(encrypted)
    return testData === decrypted
  } catch {
    return false
  }
}

/**
 * Utility to safely encrypt OAuth tokens for database storage
 */
export function encryptOAuthTokens(accessToken: string, refreshToken: string) {
  return {
    accessToken: encrypt(accessToken),
    refreshToken: encrypt(refreshToken)
  }
}

/**
 * Utility to safely decrypt OAuth tokens from database
 */
export function decryptOAuthTokens(encryptedAccessToken: string, encryptedRefreshToken: string) {
  return {
    accessToken: decrypt(encryptedAccessToken),
    refreshToken: decrypt(encryptedRefreshToken)
  }
}