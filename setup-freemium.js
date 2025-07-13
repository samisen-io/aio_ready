#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 AIO Ready - Freemium Setup');
console.log('==============================\n');

// Create necessary directories
const dirs = ['data', 'logs'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        console.log(`✅ Created directory: ${dir}`);
    }
});

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    const envContent = `# AIO Ready Environment Variables
NODE_ENV=development
PORT=3000

# Session Secret (change this in production!)
SESSION_SECRET=your-super-secret-key-change-this-in-production

# Stripe Configuration
# Get these from your Stripe dashboard: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs (create these in your Stripe dashboard)
STRIPE_PRO_PRICE_ID=price_your_pro_plan_id
STRIPE_BUSINESS_PRICE_ID=price_your_business_plan_id

# Database (SQLite is used by default)
DATABASE_URL=./data/users.db

# Optional: Redis for session storage (for production)
# REDIS_URL=redis://localhost:6379
`;

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file');
    console.log('⚠️  Please update the .env file with your actual values');
}

// Create package.json if it doesn't exist
const packagePath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packagePath)) {
    const packageContent = {
        "name": "aio-ready",
        "version": "1.0.0",
        "description": "Website AI Optimization Audit Tool - Freemium Edition",
        "main": "server-freemium.js",
        "scripts": {
            "start": "node server-freemium.js",
            "dev": "nodemon server-freemium.js",
            "setup": "node setup-freemium.js"
        },
        "keywords": [
            "ai",
            "optimization",
            "website",
            "audit",
            "seo",
            "structured-data",
            "freemium",
            "saas"
        ],
        "author": "Your Name",
        "license": "MIT",
        "dependencies": {
            "express": "^4.18.2",
            "cors": "^2.8.5",
            "helmet": "^7.0.0",
            "morgan": "^1.10.0",
            "compression": "^1.7.4",
            "dotenv": "^16.3.1",
            "ejs": "^3.1.9",
            "axios": "^1.5.0",
            "cheerio": "^1.0.0-rc.12",
            "robots-parser": "^3.0.1",
            "validator": "^13.11.0",
            "url-parse": "^1.5.10",
            "express-session": "^1.17.3",
            "bcryptjs": "^2.4.3",
            "sqlite3": "^5.1.6",
            "stripe": "^13.5.0"
        },
        "devDependencies": {
            "nodemon": "^3.0.1"
        },
        "engines": {
            "node": ">=14.0.0"
        }
    };

    fs.writeFileSync(packagePath, JSON.stringify(packageContent, null, 2));
    console.log('✅ Created package.json');
}

// Create README for freemium setup
const readmePath = path.join(__dirname, 'README-FREEMIUM.md');
if (!fs.existsSync(readmePath)) {
    const readmeContent = `# AIO Ready - Freemium Setup Guide

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure environment variables:**
   - Edit the \`.env\` file
   - Add your Stripe API keys
   - Create price IDs in Stripe dashboard

3. **Start the server:**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Visit the application:**
   - Open http://localhost:3000
   - Register a new account
   - Start using the free tier

## Stripe Setup

1. **Create a Stripe account:**
   - Go to https://stripe.com
   - Sign up for a free account

2. **Get your API keys:**
   - Go to https://dashboard.stripe.com/apikeys
   - Copy your publishable and secret keys
   - Update the \`.env\` file

3. **Create products and prices:**
   - Go to https://dashboard.stripe.com/products
   - Create two products: "Pro Plan" and "Business Plan"
   - Set recurring prices: $19/month and $49/month
   - Copy the price IDs to your \`.env\` file

4. **Set up webhooks:**
   - Go to https://dashboard.stripe.com/webhooks
   - Add endpoint: \`https://yourdomain.com/api/webhook\`
   - Select events: \`checkout.session.completed\`
   - Copy the webhook secret to your \`.env\` file

## Features

### Free Tier
- 5 audits per month
- Basic audit results
- JSON export
- Community support

### Pro Tier ($19/month)
- 50 audits per month
- Detailed reports
- PDF/CSV export
- Email support
- API access

### Business Tier ($49/month)
- 200 audits per month
- Advanced analytics
- Team collaboration
- Priority support
- White-label options

## Deployment

### Render (Recommended)
1. Connect your GitHub repository
2. Set build command: \`npm install\`
3. Set start command: \`npm start\`
4. Add environment variables
5. Deploy!

### Railway
1. Connect your GitHub repository
2. Add environment variables
3. Deploy automatically

### DigitalOcean App Platform
1. Connect your repository
2. Configure environment variables
3. Deploy with one click

## Environment Variables

\`\`\`bash
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-super-secret-key
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRO_PRICE_ID=price_your_pro_plan
STRIPE_BUSINESS_PRICE_ID=price_your_business_plan
\`\`\`

## Support

For issues and questions:
- Check the main README.md
- Review the MONETIZATION_GUIDE.md
- Check the QUICK_START_MONETIZATION.md

## License

MIT License - see LICENSE file for details
`;

    fs.writeFileSync(readmePath, readmeContent);
    console.log('✅ Created README-FREEMIUM.md');
}

console.log('\n🎉 Setup complete!');
console.log('\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Update .env file with your Stripe keys');
console.log('3. Run: npm run dev');
console.log('4. Visit: http://localhost:3000');
console.log('\n📚 Check README-FREEMIUM.md for detailed instructions');

rl.close(); 