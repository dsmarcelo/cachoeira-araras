# Mercado Pago Checkout Pro Implementation

## Overview

This document describes the improved Mercado Pago Checkout Pro integration for the Cachoeira das Araras voucher system. The implementation follows Mercado Pago best practices and security guidelines.

## Architecture

### Backend Implementation

#### File: `src/server/api/routers/mercadopago.ts`

**Key Features:**

- **Access Token Security**: Uses Access Token in Authorization header (not query params)
- **Proper Configuration**: Client initialized with timeout and idempotency key
- **Enhanced Validation**: Zod schemas with proper constraints
- **Error Handling**: Comprehensive error handling with detailed logging
- **Documentation**: Extensive inline comments explaining each component

**Procedures:**

1. `create` - Creates payment preference with:

   - Item configuration
   - Payer information (name, surname, phone)
   - Return URLs for payment completion
   - 10-day expiration period
   - Webhook notification URL
   - Payment method exclusions

2. `getPreference` - Retrieves preference details (safe)
3. `getPrefence` - Retrieves preference with error throwing
4. `getPreferenceByEReference` - Finds preference by external reference
5. `getPayment` - Retrieves payment details

**Security Best Practices:**

- Credentials stored in environment variables
- No sensitive data in URLs or query parameters
- Proper phone number validation (11 digits)
- Input validation with Zod schemas
- Comprehensive error handling

### Webhook Implementation

#### File: `src/app/api/webhook/route.ts`

**Key Features:**

- **HMAC Signature Validation**: Uses SHA-256 for webhook verification
- **Timing-Safe Comparison**: Prevents timing attacks
- **Idempotency**: Skips already processed vouchers
- **Non-Blocking Analytics**: Facebook Pixel and Google Ads don't block webhook
- **Proper Status Codes**: Returns appropriate HTTP status codes

**Flow:**

1. Extract and validate headers (x-signature, x-request-id)
2. Extract payment ID from query parameters
3. Validate webhook signature
4. Process payment and update voucher status
5. Send analytics events (non-blocking)
6. Return success/error response

**Security Features:**

- Constant-time signature comparison
- Request ID tracking to prevent replay attacks
- Proper error handling and logging
- No external failures affect webhook processing

## Payment Flow

### 1. Preference Creation

```
User submits form → Backend creates preference →
Returns init_point → User redirected to Mercado Pago
```

### 2. Payment Processing

```
User completes payment → Mercado Pago sends webhook →
Backend validates signature → Updates voucher status →
Sends analytics events
```

### 3. Return Flow

```
User returns to site → Backend checks payment status →
Displays appropriate message (success/pending/failure)
```

## Security Considerations

### Access Token

- ✅ Stored in environment variables
- ✅ Sent in Authorization header (not query params)
- ✅ Never exposed to client-side code

### Webhook Security

- ✅ HMAC SHA-256 signature validation
- ✅ Timing-safe comparison
- ✅ Request ID validation
- ✅ Proper error handling

### PCI DSS Compliance

- ✅ Checkout Pro delegates security to Mercado Pago
- ✅ No card data touches our servers
- ✅ SAQ-A compliance

## Error Handling

### Status Codes

- `200` - Success
- `400` - Bad Request (invalid signature, missing headers)
- `404` - Not Found (payment or voucher not found)
- `500` - Internal Server Error

### Error Scenarios

1. **Invalid Signature**: Returns 400, logs error
2. **Missing Headers**: Returns 400, logs error
3. **Payment Not Found**: Returns 404, logs error
4. **Voucher Not Found**: Returns 404, logs error
5. **Already Redeemed**: Returns 200 with skipped flag
6. **Processing Error**: Returns 500, logs detailed error

## Configuration

### Environment Variables

```env
MERCADOPAGO_TOKEN=your_access_token
WEBHOOK_URL=https://your-domain.com
WEBHOOK_SECRET=your_webhook_secret
URL=https://your-domain.com
```

### Preference Configuration

- **Expiration**: 10 days
- **Auto Return**: On approved payments
- **Currency**: BRL (Brazilian Real)
- **Statement Descriptor**: "Cachoeira das Araras"
- **Excluded Methods**: Boleto bancário, Pagamento em casa lotérica

## Testing

### Checklist

- [ ] Test preference creation
- [ ] Test webhook signature validation
- [ ] Test approved payment flow
- [ ] Test rejected payment flow
- [ ] Test pending payment flow
- [ ] Test duplicate webhook delivery
- [ ] Test invalid signature handling
- [ ] Test missing data handling

## Monitoring

### Logs to Monitor

- Payment creation attempts
- Webhook signature validation failures
- Payment processing errors
- Analytics event failures
- Missing voucher codes

### Key Metrics

- Payment success rate
- Webhook delivery success rate
- Average payment processing time
- Failed webhook attempts

## Troubleshooting

### Common Issues

**Issue**: Webhook signature validation fails

- **Solution**: Verify WEBHOOK_SECRET matches Mercado Pago configuration

**Issue**: Payment not updating voucher

- **Solution**: Check webhook URL is accessible, verify signature

**Issue**: Duplicate webhook deliveries

- **Solution**: Already handled with idempotency checks

**Issue**: Analytics events not firing

- **Solution**: Non-blocking, won't affect payment processing

## References

- [Mercado Pago Documentation](https://www.mercadopago.com/developers)
- [Checkout Pro Guide](https://www.mercadopago.com/developers/en/docs/checkout-pro)
- [Webhook Documentation](https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks)
- [Security Best Practices](https://www.mercadopago.com/developers/en/docs/checkout-api/best-practices/credentials-best-practices)

## Version History

- **v2.0** (Current) - Enhanced security, better error handling, comprehensive documentation
- **v1.0** - Initial implementation with basic functionality
