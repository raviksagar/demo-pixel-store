const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIGURATION - Update these values before deploying
// ============================================================

// Your Facebook Pixel ID (get from Meta Events Manager)
const PIXEL_ID = process.env.PIXEL_ID || 'YOUR_PIXEL_ID';

// Your Facebook Access Token (set as environment variable - NEVER commit this!)
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

// Test Event Code (optional - use for testing without polluting production data)
// Get this from Events Manager > Test Events tab
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE || null;

// Facebook Graph API version (update periodically as Meta deprecates old versions)
const API_VERSION = 'v21.0';

// CORS Configuration - Add your frontend domains here
const ALLOWED_ORIGINS = [
    'https://abhinav14kr.github.io',  // GitHub Pages
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:5500'  // VS Code Live Server
];

// ============================================================

app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.use(express.json());

// ===== HASHING FUNCTIONS =====
// Facebook requires user data to be hashed with SHA-256

function hashData(data) {
    if (!data || data.trim() === '') return null;
    // Normalize: lowercase and trim whitespace
    const normalized = data.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

function hashPhone(phone) {
    if (!phone) return null;
    // Remove all non-numeric characters
    const normalized = phone.replace(/\D/g, '');
    if (normalized === '') return null;
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ===== ENDPOINTS =====

// Health check endpoint
app.get('/', function(req, res) {
    const tokenConfigured = !!ACCESS_TOKEN;
    const pixelConfigured = PIXEL_ID !== 'YOUR_PIXEL_ID';
    res.json({
        status: 'CAPI Backend is running',
        pixel_id_configured: pixelConfigured,
        api_version: API_VERSION,
        access_token_configured: tokenConfigured,
        message: 'POST to /api/event to send events',
        endpoints: {
            health: 'GET /',
            test: 'GET /api/test',
            event: 'POST /api/event'
        }
    });
});

// Test endpoint to verify configuration
app.get('/api/test', function(req, res) {
    const tokenConfigured = !!ACCESS_TOKEN;
    const pixelConfigured = PIXEL_ID !== 'YOUR_PIXEL_ID';
    const tokenPreview = ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 10) + '...' : 'NOT SET';

    console.log('\n=== Configuration Test ===');
    console.log('Pixel ID Configured:', pixelConfigured);
    console.log('API Version:', API_VERSION);
    console.log('Access Token Configured:', tokenConfigured);
    console.log('Access Token Preview:', tokenPreview);
    console.log('==========================\n');

    res.json({
        status: 'Configuration Check',
        pixel_id_configured: pixelConfigured,
        api_version: API_VERSION,
        access_token_configured: tokenConfigured,
        access_token_preview: tokenPreview,
        graph_api_url: `https://graph.facebook.com/${API_VERSION}/<PIXEL_ID>/events`,
        allowed_origins: ALLOWED_ORIGINS
    });
});

// Main event endpoint
app.post('/api/event', async function(req, res) {
    const requestStartTime = Date.now();
    const requestTimestamp = new Date().toISOString();
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║       INCOMING CAPI REQUEST            ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('⏱️  Request received at:', requestTimestamp);

    // Log the raw request
    console.log('\n📥 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('📥 Request Headers:', JSON.stringify({
        'content-type': req.headers['content-type'],
        'origin': req.headers['origin'],
        'x-forwarded-for': req.headers['x-forwarded-for']
    }, null, 2));

    // Check for access token
    if (!ACCESS_TOKEN) {
        console.error('❌ ERROR: FB_ACCESS_TOKEN environment variable not set!');
        return res.status(500).json({
            success: false,
            error: 'Access token not configured on server',
            hint: 'Set FB_ACCESS_TOKEN environment variable'
        });
    }

    // Check for Pixel ID
    if (PIXEL_ID === 'YOUR_PIXEL_ID') {
        console.error('❌ ERROR: PIXEL_ID not configured!');
        return res.status(500).json({
            success: false,
            error: 'Pixel ID not configured on server',
            hint: 'Set PIXEL_ID environment variable'
        });
    }

    // Extract request data
    const eventName = req.body.eventName;
    const eventData = req.body.eventData || {};
    const userData = req.body.userData || {};
    const eventSourceUrl = req.body.eventSourceUrl;
    const clientUserAgent = req.body.clientUserAgent;
    let eventId = req.body.eventId;

    // Validate required fields
    if (!eventName) {
        console.error('❌ ERROR: Missing eventName');
        return res.status(400).json({
            success: false,
            error: 'eventName is required'
        });
    }

    // Generate event ID if not provided
    const eventTime = Math.floor(Date.now() / 1000);
    if (!eventId) {
        eventId = eventName + '_' + eventTime + '_' + Math.random().toString(36).substr(2, 9);
        console.log('⚠️  No eventId provided, generated:', eventId);
    }

    console.log('\n📋 Event Details:');
    console.log('   Event Name:', eventName);
    console.log('   Event ID:', eventId);
    console.log('   Event Time:', eventTime, '(' + new Date(eventTime * 1000).toISOString() + ')');
    console.log('   Source URL:', eventSourceUrl);

    // Get client IP address (important for matching)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.socket?.remoteAddress ||
                     req.ip ||
                     'unknown';

    // Build user_data payload with hashed values
    const userDataPayload = {
        client_ip_address: clientIp,
        client_user_agent: clientUserAgent || req.headers['user-agent']
    };

    console.log('\n👤 User Data Processing:');

    // Hash email
    if (userData.email) {
        userDataPayload.em = [hashData(userData.email)];
        console.log('   Email: [provided] → hashed');
    }

    // Hash phone
    if (userData.phone) {
        const hashedPhone = hashPhone(userData.phone);
        if (hashedPhone) {
            userDataPayload.ph = [hashedPhone];
            console.log('   Phone: [provided] → hashed');
        }
    }

    // Hash first name
    if (userData.firstName) {
        userDataPayload.fn = [hashData(userData.firstName)];
        console.log('   First Name: [provided] → hashed');
    }

    // Hash last name
    if (userData.lastName) {
        userDataPayload.ln = [hashData(userData.lastName)];
        console.log('   Last Name: [provided] → hashed');
    }

    // Facebook click ID (not hashed - passed as-is)
    if (userData.fbc) {
        userDataPayload.fbc = userData.fbc;
        console.log('   FBC: [provided]');
    }

    // Facebook browser ID (not hashed - passed as-is)
    if (userData.fbp) {
        userDataPayload.fbp = userData.fbp;
        console.log('   FBP: [provided]');
    }

    // External ID (hashed - useful for cross-platform matching)
    if (userData.externalId) {
        userDataPayload.external_id = [hashData(userData.externalId)];
        console.log('   External ID: [provided] → hashed');
    }

    console.log('   Client IP:', clientIp);
    console.log('   User Agent:', (clientUserAgent || '').substring(0, 50) + '...');

    // Build the Facebook API payload
    const payload = {
        data: [{
            event_name: eventName,
            event_time: eventTime,
            event_id: eventId,
            event_source_url: eventSourceUrl,
            action_source: 'website',
            user_data: userDataPayload,
            custom_data: eventData
        }]
    };

    // Add test_event_code if configured (routes events to Test Events tab in Events Manager)
    const testCode = req.body.testEventCode || TEST_EVENT_CODE;
    if (testCode) {
        payload.test_event_code = testCode;
        console.log('\n🧪 Test Event Code:', testCode);
    }

    console.log('\n📤 Facebook API Payload:');
    console.log(JSON.stringify(payload, null, 2));

    // Build the Graph API URL (token sent in request body, not URL, to avoid leaking in logs)
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
    console.log('\n🌐 Calling Facebook Graph API...');
    console.log('   URL:', url);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, access_token: ACCESS_TOKEN })
        });

        const result = await response.json();

        console.log('\n📨 Facebook Response:');
        console.log('   Status:', response.status, response.ok ? '✓' : '✗');
        console.log('   Body:', JSON.stringify(result, null, 2));
        
        const fbResponseTime = Date.now();
        const totalLatency = fbResponseTime - requestStartTime;
        console.log('\n⏱️  Timing:');
        console.log('   Request received:', requestTimestamp);
        console.log('   FB response at:', new Date().toISOString());
        console.log('   Total latency:', totalLatency + 'ms');

        if (response.ok) {
            console.log('\n✅ SUCCESS: Event sent to Facebook');
            console.log('   Events Received:', result.events_received);
            if (result.messages && result.messages.length > 0) {
                console.log('   Messages:', result.messages);
            }
        } else {
            console.log('\n❌ FAILED: Facebook rejected the event');
            if (result.error) {
                console.log('   Error Code:', result.error.code);
                console.log('   Error Message:', result.error.message);
                console.log('   Error Type:', result.error.type);
            }
        }

        console.log('\n════════════════════════════════════════\n');

        res.json({
            success: response.ok,
            eventId: eventId,
            eventTime: eventTime,
            result: result,
            timing: {
                requestReceivedAt: requestTimestamp,
                fbResponseAt: new Date().toISOString(),
                totalLatencyMs: Date.now() - requestStartTime
            }
        });

    } catch (error) {
        console.error('\n❌ NETWORK ERROR:', error.message);
        console.error('   Stack:', error.stack);
        console.log('\n════════════════════════════════════════\n');

        res.status(500).json({
            success: false,
            error: error.message,
            hint: 'Network error calling Facebook API'
        });
    }
});

// Start server
app.listen(PORT, function() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Facebook CAPI Backend Started        ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('🚀 Server running on port:', PORT);
    console.log('📊 Pixel ID:', PIXEL_ID !== 'YOUR_PIXEL_ID' ? 'Configured' : '⚠️  NOT SET');
    console.log('📡 API Version:', API_VERSION);
    console.log('🧪 Test Event Code:', TEST_EVENT_CODE ? 'Configured' : 'Not set (events go to production)');

    if (ACCESS_TOKEN) {
        console.log('🔑 Access Token: Configured');
    } else {
        console.warn('\n⚠️  WARNING: FB_ACCESS_TOKEN not set!');
        console.warn('   Events will fail until you set this environment variable.');
    }

    if (PIXEL_ID === 'YOUR_PIXEL_ID') {
        console.warn('\n⚠️  WARNING: PIXEL_ID not set!');
        console.warn('   Set the PIXEL_ID environment variable to your Facebook Pixel ID.');
    }

    console.log('\n📌 Endpoints:');
    console.log('   GET  /          - Health check');
    console.log('   GET  /api/test  - Configuration test');
    console.log('   POST /api/event - Send CAPI event');
    console.log('');
});
