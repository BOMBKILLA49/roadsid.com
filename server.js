require('dotenv').config();
const express    = require('express');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sgMail = require('@sendgrid/mail');                 
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const path       = require('path');

console.log('STRIPE_SECRET_KEY set:', !!process.env.STRIPE_SECRET_KEY);
console.log('SMTP_USER set:', !!process.env.SMTP_USER);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', stripe: !!process.env.STRIPE_SECRET_KEY });
});

// ── Email transporter ───────────────────────────────────────

function buildEmailHTML(d) {
  const mapsLink = `https://maps.google.com/?q=${d.customerLat},${d.customerLng}`;
  const destMapsLink = d.destLat && d.destLng
    ? `https://maps.google.com/?q=${d.destLat},${d.destLng}`
    : null;

  const destRow = d.destination && d.destination !== 'N/A'
    ? `<tr>
        <td style="padding:10px 0;color:#888;font-size:14px;width:140px;">Destination</td>
        <td style="padding:10px 0;font-size:14px;">
          ${d.destination}
          ${destMapsLink ? `<br><a href="${destMapsLink}" style="color:#FF6B1A;font-size:12px;">Open in Maps</a>` : ''}
        </td>
       </tr>
       <tr>
        <td style="padding:10px 0;color:#888;font-size:14px;">Distance</td>
        <td style="padding:10px 0;font-size:14px;font-weight:600;">${d.miles} miles</td>
       </tr>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <div style="max-width:580px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12);">

    <!-- Header -->
    <div style="background:#FF6B1A;padding:24px 28px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">🚛 New Tow Request</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">
        ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short' })}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">

      <!-- Contact -->
      <h2 style="margin:0 0 14px;font-size:15px;color:#333;text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid #FF6B1A;padding-bottom:8px;">Customer Info</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;width:140px;">Phone</td>
          <td style="padding:10px 0;font-size:16px;font-weight:700;">
            <a href="tel:${d.phone}" style="color:#FF6B1A;text-decoration:none;">${d.phone}</a>
          </td>
        </tr>
      </table>

      <!-- Location -->
      <h2 style="margin:20px 0 14px;font-size:15px;color:#333;text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid #FF6B1A;padding-bottom:8px;">Pickup Location</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;width:140px;">GPS Coordinates</td>
          <td style="padding:10px 0;">
            <code style="font-size:15px;font-weight:700;color:#222;">${d.customerLat}, ${d.customerLng}</code><br>
            <a href="${mapsLink}" style="color:#FF6B1A;font-size:13px;font-weight:600;">📍 Open in Google Maps</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;">Address</td>
          <td style="padding:10px 0;font-size:13px;color:#555;">${d.customerAddress}</td>
        </tr>
      </table>

      <!-- Service -->
      <h2 style="margin:20px 0 14px;font-size:15px;color:#333;text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid #FF6B1A;padding-bottom:8px;">Service Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;width:140px;">Service</td>
          <td style="padding:10px 0;font-size:14px;font-weight:600;">${d.serviceType}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;">Vehicle</td>
          <td style="padding:10px 0;font-size:14px;font-weight:600;">${d.vehicleType}</td>
        </tr>
        ${destRow}
      </table>

      <!-- Price -->
      <h2 style="margin:20px 0 14px;font-size:15px;color:#333;text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid #FF6B1A;padding-bottom:8px;">Price</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:14px;width:140px;">Base / Service Fee</td>
          <td style="padding:8px 0;font-size:14px;">$${d.priceBreakdown.base}</td>
        </tr>
        ${Number(d.priceBreakdown.mileage) > 0 ? `
        <tr>
          <td style="padding:8px 0;color:#888;font-size:14px;">Mileage Fee</td>
          <td style="padding:8px 0;font-size:14px;">$${d.priceBreakdown.mileage}</td>
        </tr>` : ''}
        <tr style="border-top:1px solid #eee;">
          <td style="padding:12px 0;font-size:16px;font-weight:700;">Total Charged</td>
          <td style="padding:12px 0;font-size:20px;font-weight:900;color:#FF6B1A;">$${d.priceBreakdown.total}</td>
        </tr>
      </table>

    </div>

    <!-- Footer -->
    <div style="background:#f8f8f8;padding:16px 28px;font-size:12px;color:#aaa;text-align:center;">
      Zia Tow · info@ziatow.com · Payment processed via Stripe
    </div>
  </div>
</body>
</html>`;
}

// ── Create PaymentIntent + send dispatch email ──────────────
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const {
      amount, serviceType, vehicleType, phone,
      customerLat, customerLng, customerAddress,
      destLat, destLng, destination,
      miles, priceBreakdown,
    } = req.body;

    if (!amount || Number(amount) < 0.50) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `ZiaTow – ${serviceType || 'service'}`,
      metadata: {
        phone:           phone            || '',
        serviceType:     serviceType      || '',
        vehicleType:     vehicleType      || '',
        customerCoords:  `${customerLat}, ${customerLng}`,
        customerAddress: customerAddress  || '',
        destination:     destination      || 'N/A',
        miles:           miles            || '0',
      },
    });

    // Send dispatch email (non-blocking — don't fail the request if email fails)
  sgMail.send({                                                                                                             
    from: `info@ziatow.com`,
    to: 'zimred49@gmail.com',                                                                                                  
    subject: `New ${serviceType || 'Service'} Request – ${phone || 'Unknown'}`,
    html: buildEmailHTML({                                                                                                  
      phone, serviceType, vehicleType,                                                                                      
      customerLat, customerLng, customerAddress,                                                                            
      destLat, destLng, destination,                                                                                        
      miles, priceBreakdown,                                                                                                
    }),                                                     
  }).catch(err => console.error('Email error:', err.message, err.response?.body));

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Serve index.html for all other routes ──────────────────
  const https = require('https');                                                                                           
                                                                                                                            
  app.get('/api/places/autocomplete', async (req, res) => {
    const q = req.query.q;                                                                                                  
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=address&c
  omponents=country:us&key=${process.env.GOOGLE_API_KEY}`;                                                                  
    const r = await fetch(url);
    const data = await r.json();                                                                                            
    res.json(data.predictions || []);                       
  });                                                                                                                       
                                                            
  app.get('/api/places/details', async (req, res) => {                                                                      
    const placeId = req.query.place_id;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${process.e
  nv.GOOGLE_API_KEY}`;                                                                                                      
    const r = await fetch(url);
    const data = await r.json();                                                                                            
    res.json(data.result || {});                            
  });
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅  ZiaTow server running → http://localhost:${PORT}\n`);
});
