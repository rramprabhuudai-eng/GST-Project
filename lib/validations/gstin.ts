import { z } from 'zod'

// GSTIN format: 2 digits + 10 alphanumeric + 1 letter + 1 digit + 1 letter
// Example: 27AAPFU0939F1ZV
const GSTIN_REGEX = /^[0-9]{2}[A-Z0-9]{10}[A-Z][0-9][A-Z]$/

export const gstinSchema = z.string().regex(GSTIN_REGEX, {
  message: 'Invalid GSTIN format. Expected format: 2 digits + 10 alphanumeric + 1 letter + 1 digit + 1 letter',
})

export function validateGSTIN(gstin: string): {
  isValid: boolean
  stateCode?: string
  error?: string
} {
  const trimmedGSTIN = gstin.trim().toUpperCase()

  if (!GSTIN_REGEX.test(trimmedGSTIN)) {
    return {
      isValid: false,
      error: 'Invalid GSTIN format. Expected format: 2 digits + 10 alphanumeric + 1 letter + 1 digit + 1 letter (e.g., 27AAPFU0939F1ZV)',
    }
  }

  const stateCode = trimmedGSTIN.substring(0, 2)

  // Validate state code is between 01 and 37
  const stateCodeNum = parseInt(stateCode, 10)
  if (stateCodeNum < 1 || stateCodeNum > 37) {
    return {
      isValid: false,
      error: 'Invalid state code in GSTIN. State code must be between 01 and 37.',
    }
  }

  return {
    isValid: true,
    stateCode,
  }
}

export const STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
}
