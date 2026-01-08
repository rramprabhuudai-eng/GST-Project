import { z } from 'zod'

// Indian phone number validation (10 digits)
export const phoneSchema = z.string()
  .regex(/^[6-9]\d{9}$/, {
    message: 'Invalid phone number. Must be 10 digits starting with 6-9',
  })

export function formatPhoneForSupabase(phone: string, countryCode: string = '+91'): string {
  // Remove any spaces or special characters
  const cleanPhone = phone.replace(/\s+/g, '')

  // If phone already has country code, return as is
  if (cleanPhone.startsWith('+')) {
    return cleanPhone
  }

  // Add country code
  return `${countryCode}${cleanPhone}`
}

export function validatePhone(phone: string): {
  isValid: boolean
  error?: string
} {
  const cleanPhone = phone.replace(/\s+/g, '')

  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return {
      isValid: false,
      error: 'Invalid phone number. Must be 10 digits starting with 6-9',
    }
  }

  return {
    isValid: true,
  }
}
