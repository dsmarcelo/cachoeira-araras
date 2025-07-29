/*
  Voucher type definition file
  Updated Voucher type so that payment_id, expires_at, and deletedAt are non-optional with null as possible value. This change resolves type mismatches with transformed voucher objects in the dashboard page.
*/
// VoucherType is defined as a const object for JS compatibility
export const VoucherType = {
  default: "default",
  pool: "pool",
} as const;

export type VoucherType = (typeof VoucherType)[keyof typeof VoucherType];

export type Voucher = {
  id: number; // Unique identifier for the voucher
  name: string; // Name associated with the voucher
  phone: string; // Phone number associated with the voucher
  code: string; // Voucher code
  adults: number; // Number of full fare tickets
  elderly: number; // Number of half fare tickets
  price: number; // Price of the voucher
  valid: boolean; // Indicates if voucher is valid
  status: string; // Status of the voucher (e.g., 'paid', 'pending')
  preference_id: string; // Identifier for a preference or configuration
  payment_id: string | null; // Payment identifier, can be null
  expires_at: Date | null; // Expiry date of the voucher, can be null
  createdAt: Date; // Creation date of the voucher
  updatedAt: Date; // Last update timestamp
  deletedAt: Date | null; // Deletion timestamp (if voucher was deleted), can be null
  type: VoucherType; // Type of voucher
};
