// Test for Facebook Pixel webhook functionality with real API call
// Run with: node test-simple.js

import crypto from 'crypto';

// Mock environment variables for testing
process.env.FACEBOOK_PIXEL_ID = '1471941854234147';
process.env.FACEBOOK_ACCESS_TOKEN = 'EAAUrVB9G96sBPOhN5jsdU6h1qDBhtlDegA3xCO7zdJZBXitfsJsCMwPbQnMLwDgtZBGfmut9pzxPvcuxhzH2cQMGA0IXIhUgU0WnS4WQglcx8ygZAge6KqGWrFz4Yr8FlIruZAhZBRrvfzYFwgcugs3Kop7O7KdtM78iu03nqPzQTTTqfisvzFgX0vyOFTl2ldAZDZD';


console.log('🧪 Testing Facebook Pixel webhook functionality...');

// Mock payment data
const mockPayment = {
  status: 'approved',
  payer: {
    email: 'testuser@example.com'
  },
  transaction_amount: 123.45,
  id: 123456
};

console.log('📧 Email:', mockPayment.payer.email);
console.log('💰 Amount:', mockPayment.transaction_amount);
console.log('🆔 Payment ID:', mockPayment.id);

// Check if environment variables are set
if (!process.env.FACEBOOK_PIXEL_ID || !process.env.FACEBOOK_ACCESS_TOKEN) {
  console.log('❌ Environment variables not set');
  console.log('💡 Set these environment variables:');
  console.log('   FACEBOOK_PIXEL_ID=your_pixel_id');
  console.log('   FACEBOOK_ACCESS_TOKEN=your_access_token');
} else {
  console.log('✅ Environment variables found');
  console.log('📡 Would send to Facebook Pixel ID:', process.env.FACEBOOK_PIXEL_ID);
}

// Simulate the email hashing
const emailHash = crypto
  .createHash('sha256')
  .update(mockPayment.payer.email.trim().toLowerCase())
  .digest('hex');

console.log('🔐 Email hash:', emailHash);

// Build the event payload (what would be sent to Facebook)
const evento = {
  data: [{
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: {
      em: emailHash
    },
    custom_data: {
      currency: 'BRL',
      value: mockPayment.transaction_amount,
      transaction_id: mockPayment.id.toString()
    }
  }]
};

console.log('📦 Event payload:');
console.log(JSON.stringify(evento, null, 2));

// Now test with the real Facebook API
console.log('');
console.log('🚀 Testing with real Facebook API...');

// Copy the sendFacebookPixelEvent function from webhook-pixel.ts
async function sendFacebookPixelEvent(payment) {
  try {
    // Validate environment variables
    if (!process.env.FACEBOOK_PIXEL_ID || !process.env.FACEBOOK_ACCESS_TOKEN) {
      console.error('Facebook Pixel configuration missing: PIXEL_ID or ACCESS_TOKEN not set');
      return false;
    }

    // Check if payment is approved and has payer email
    if (payment.status !== 'approved' || !payment.payer?.email) {
      console.log('Payment not approved or missing payer email, skipping Facebook Pixel event');
      return false;
    }

    // Create SHA256 hash of the email (normalized to lowercase and trimmed)
    const emailHash = crypto
      .createHash('sha256')
      .update(payment.payer.email.trim().toLowerCase())
      .digest('hex');

    // Build the Facebook Pixel event
    const evento = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: {
          em: emailHash
        },
        custom_data: {
          currency: 'BRL',
          value: payment.transaction_amount ?? 0,
          transaction_id: payment.id?.toString() ?? ''
        }
      }]
    };

    // Send the event to Facebook Conversions API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.FACEBOOK_PIXEL_ID}/events?access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(evento),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Facebook Pixel API error:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('Facebook Pixel event sent successfully:', result);

    // Also send Google Ads conversion
    try {
      await sendGoogleAdsConversion(payment);
    } catch (error) {
      console.error('Error sending Google Ads conversion:', error);
      // Don't fail the main function if Google Ads fails
    }

    return true;

  } catch (error) {
    console.error('Error sending Facebook Pixel event:', error);
    return false;
  }
}

// Google Analytics conversion function (corrected implementation)
async function sendGoogleAdsConversion(payment) {
  try {
    // Check if payment is approved
    if (payment.status !== 'approved') {
      console.log('Payment not approved, skipping Google Analytics conversion');
      return false;
    }

    // Google Analytics configuration (mock for testing)
    const measurementId = process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID || 'G-XXXXXXXXXX';
    const apiSecret = process.env.GOOGLE_ANALYTICS_API_SECRET || 'mock_secret_for_testing';

    if (!process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID || !process.env.GOOGLE_ANALYTICS_API_SECRET) {
      console.log('📊 Google Analytics configuration missing, using mock values for testing');
    }

    // Generate a client ID (using payment ID as a unique identifier)
    const clientId = payment.id?.toString() ?? Math.random().toString();

    // Build the Google Analytics 4 conversion payload
    const payload = {
      client_id: clientId,
      events: [{
        name: 'purchase',
        params: {
          transaction_id: payment.id?.toString() ?? '',
          value: payment.transaction_amount ?? 0,
          currency: 'BRL',
          items: [{
            item_id: 'voucher',
            item_name: 'Voucher Cachoeira das Araras',
            currency: 'BRL',
            price: payment.transaction_amount ?? 0,
            quantity: 1
          }]
        }
      }]
    };

    console.log('📊 Google Analytics conversion payload:', JSON.stringify(payload, null, 2));

    // Send to Google Analytics 4 Measurement Protocol
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Analytics conversion API error:', response.status, errorText);
      return false;
    }

    console.log('Google Analytics conversion sent successfully');
    return true;

  } catch (error) {
    console.error('Error sending Google Analytics conversion:', error);
    return false;
  }
}

// Test with the real API
const result = await sendFacebookPixelEvent(mockPayment);
if (result) {
  console.log('✅ Facebook Pixel event sent successfully to real API!');
} else {
  console.log('❌ Failed to send Facebook Pixel event to real API');
}

console.log('');
console.log('✅ Test completed!');