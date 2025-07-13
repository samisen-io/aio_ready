# Quick Start Monetization Implementation

Get your AIO Ready app monetized and hosted in 1-2 weeks with these essential features.

## 🚀 Week 1: Basic Setup

### Day 1-2: Hosting Setup

#### **Option A: Render (Recommended for beginners)**
1. Create account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Create new Web Service
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     ```
     NODE_ENV=production
     PORT=3000
     SESSION_SECRET=your-random-secret-key
     ```

#### **Option B: Railway (Alternative)**
1. Create account at [railway.app](https://railway.app)
2. Connect GitHub repository
3. Deploy automatically
4. Add environment variables in dashboard

### Day 3-4: Basic Authentication

#### 1. Install Dependencies
```bash
npm install express-session bcryptjs sqlite3
```

#### 2. Create Simple User System
```javascript
// Add to server.js
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

// Initialize database
const db = new sqlite3.Database('./users.db');

// Create users table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        plan TEXT DEFAULT 'free',
        audit_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Simple auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};
```

#### 3. Add Login/Register Routes
```javascript
// Login page
app.get('/login', (req, res) => {
    res.render('login', { error: req.query.error });
});

// Register page
app.get('/register', (req, res) => {
    res.render('register', { error: req.query.error });
});

// Login POST
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.redirect('/login?error=invalid');
        }
        
        req.session.userId = user.id;
        res.redirect('/dashboard');
    });
});

// Register POST
app.post('/register', (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
        [email, hashedPassword], (err) => {
        if (err) {
            return res.redirect('/register?error=exists');
        }
        res.redirect('/login?success=registered');
    });
});
```

### Day 5-7: Subscription System

#### 1. Add Plan Limits
```javascript
// Add to server.js
const PLAN_LIMITS = {
    free: 5,
    pro: 50,
    business: 200,
    enterprise: Infinity
};

// Check audit limits middleware
const checkAuditLimit = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    db.get('SELECT plan, audit_count FROM users WHERE id = ?', 
        [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'User not found' });
        }
        
        const limit = PLAN_LIMITS[user.plan] || 5;
        
        if (user.audit_count >= limit) {
            return res.status(402).json({ 
                error: 'Audit limit reached',
                upgrade: true,
                currentPlan: user.plan,
                limit: limit
            });
        }
        
        next();
    });
};
```

#### 2. Update Audit Endpoint
```javascript
// Modify existing audit endpoint
app.post('/api/audit', checkAuditLimit, rateLimit, async (req, res) => {
    try {
        // ... existing audit logic ...
        
        // Increment audit count
        db.run('UPDATE users SET audit_count = audit_count + 1 WHERE id = ?', 
            [req.session.userId]);
        
        // ... rest of existing code ...
    } catch (error) {
        // ... existing error handling ...
    }
});
```

## 🚀 Week 2: Payment Integration

### Day 1-3: Stripe Setup

#### 1. Install Stripe
```bash
npm install stripe
```

#### 2. Add Stripe Configuration
```javascript
// Add to server.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Pricing configuration
const PRICING = {
    pro: {
        priceId: 'price_1234567890', // Create in Stripe dashboard
        amount: 1900, // $19.00
        name: 'Pro Plan'
    },
    business: {
        priceId: 'price_0987654321',
        amount: 4900, // $49.00
        name: 'Business Plan'
    }
};
```

#### 3. Add Payment Routes
```javascript
// Create checkout session
app.post('/api/create-checkout-session', requireAuth, async (req, res) => {
    try {
        const { plan } = req.body;
        const pricing = PRICING[plan];
        
        if (!pricing) {
            return res.status(400).json({ error: 'Invalid plan' });
        }
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: pricing.priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${req.protocol}://${req.get('host')}/dashboard?success=true`,
            cancel_url: `${req.protocol}://${req.get('host')}/pricing?canceled=true`,
            client_reference_id: req.session.userId,
        });
        
        res.json({ sessionId: session.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stripe webhook
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id;
        
        // Update user plan
        db.run('UPDATE users SET plan = ? WHERE id = ?', 
            ['pro', userId]); // You can determine plan from session
    }
    
    res.json({ received: true });
});
```

### Day 4-5: Frontend Updates

#### 1. Create Dashboard Page
```html
<!-- views/dashboard.ejs -->
<!DOCTYPE html>
<html>
<head>
    <title>Dashboard - AIO Ready</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome, <%= user.email %></h1>
            <p>Your AIO Ready Dashboard</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>Current Plan</h3>
                <p><%= user.plan.toUpperCase() %></p>
            </div>
            <div class="stat-card">
                <h3>Audits Used</h3>
                <p><%= user.audit_count %> / <%= limits[user.plan] %></p>
            </div>
        </div>
        
        <div class="audit-form">
            <!-- Existing audit form -->
        </div>
        
        <% if (user.plan === 'free') { %>
        <div class="upgrade-banner">
            <h3>Upgrade to Pro</h3>
            <p>Get 50 audits per month and advanced features</p>
            <button onclick="upgradeToPro()">Upgrade Now - $19/month</button>
        </div>
        <% } %>
    </div>
    
    <script src="https://js.stripe.com/v3/"></script>
    <script>
        const stripe = Stripe('<%= stripePublishableKey %>');
        
        async function upgradeToPro() {
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: 'pro' })
            });
            
            const { sessionId } = await response.json();
            const result = await stripe.redirectToCheckout({ sessionId });
            
            if (result.error) {
                alert(result.error.message);
            }
        }
    </script>
</body>
</html>
```

#### 2. Update Main Page
```javascript
// Modify index.ejs to redirect authenticated users
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    
    res.render('index', {
        // ... existing parameters ...
    });
});
```

### Day 6-7: Testing & Polish

#### 1. Test Payment Flow
- Test registration/login
- Test audit limits
- Test payment processing
- Test webhook handling

#### 2. Add Basic Analytics
```javascript
// Add to server.js
app.get('/api/stats', requireAuth, (req, res) => {
    db.get('SELECT COUNT(*) as total_users FROM users', (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        res.json({
            totalUsers: result.total_users,
            // Add more stats as needed
        });
    });
});
```

## 🔧 Environment Variables

Create a `.env` file for production:

```bash
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-super-secret-random-key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## 📊 Basic Pricing Page

Create `views/pricing.ejs`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Pricing - AIO Ready</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="container">
        <div class="pricing-grid">
            <div class="pricing-card">
                <h3>Free</h3>
                <div class="price">$0</div>
                <ul>
                    <li>5 audits per month</li>
                    <li>Basic results</li>
                    <li>JSON export</li>
                </ul>
                <button disabled>Current Plan</button>
            </div>
            
            <div class="pricing-card featured">
                <h3>Pro</h3>
                <div class="price">$19/month</div>
                <ul>
                    <li>50 audits per month</li>
                    <li>Detailed reports</li>
                    <li>PDF/CSV export</li>
                    <li>Priority support</li>
                </ul>
                <button onclick="upgradeToPro()">Upgrade Now</button>
            </div>
            
            <div class="pricing-card">
                <h3>Business</h3>
                <div class="price">$49/month</div>
                <ul>
                    <li>200 audits per month</li>
                    <li>Team collaboration</li>
                    <li>API access</li>
                    <li>White-label options</li>
                </ul>
                <button onclick="upgradeToBusiness()">Upgrade Now</button>
            </div>
        </div>
    </div>
    
    <script src="https://js.stripe.com/v3/"></script>
    <script>
        const stripe = Stripe('<%= stripePublishableKey %>');
        
        async function upgradeToPro() {
            // Same as dashboard
        }
        
        async function upgradeToBusiness() {
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: 'business' })
            });
            
            const { sessionId } = await response.json();
            const result = await stripe.redirectToCheckout({ sessionId });
            
            if (result.error) {
                alert(result.error.message);
            }
        }
    </script>
</body>
</html>
```

## 🎯 Next Steps After Launch

1. **Monitor Usage**: Track user signups, conversions, and revenue
2. **Gather Feedback**: Listen to user complaints and feature requests
3. **Optimize Conversion**: A/B test pricing, messaging, and UX
4. **Add Features**: Implement advanced features based on user demand
5. **Scale**: Upgrade hosting as traffic grows

This quick start guide gives you a functional monetized app in 2 weeks. Focus on getting users first, then optimize for revenue! 