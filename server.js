const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const validator = require('validator');
const {
    analyzeContentStructure,
    analyzeDataQuality,
    analyzePerformance,
    analyzeStructuredData,
    analyzeSocialMedia,
    analyzeAccessibility,
    analyzeSecurity,
    generateRecommendations
} = require('./lib/analyzers');
const { PageDataExtractor } = require('./services/llmOptimizer/pageDataExtractor');
const { AnthropicClient } = require('./services/llmOptimizer/anthropicClient');
const { MarkupService } = require('./services/llmOptimizer/markupService');
const { createLlmOptimizerRouter } = require('./routes/llmOptimizer');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const LLM_OPTIMIZER_BASE_PATH = '/llm-optimizer';

const llmPageDataExtractor = new PageDataExtractor();
const llmAnthropicClient = new AnthropicClient();
const llmMarkupService = new MarkupService(llmPageDataExtractor, llmAnthropicClient);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : (NODE_ENV === 'production' ? [] : true);

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
    `${LLM_OPTIMIZER_BASE_PATH}/assets`,
    express.static(path.join(__dirname, 'public', 'llm-optimizer'))
);

app.get(LLM_OPTIMIZER_BASE_PATH, (req, res) => {
    res.render('llm-optimizer', {
        basePath: LLM_OPTIMIZER_BASE_PATH,
        assetsPath: `${LLM_OPTIMIZER_BASE_PATH}/assets`
    });
});

app.use(`${LLM_OPTIMIZER_BASE_PATH}/api`, createLlmOptimizerRouter(llmMarkupService));

// Rate limiting
const auditRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Please try again later.' }
});

function getRequestProtocol(req) {
    if (req.secure) {
        return 'https';
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (forwardedProto) {
        return forwardedProto.split(',')[0];
    }
    return req.protocol;
}

// Helper function to fetch page content with better error handling
async function fetchPageContent(url, timeout = 10000) {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    ];

    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    try {
        const response = await axios.get(url, {
            timeout,
            headers: {
                'User-Agent': randomUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            },
            maxRedirects: 5,
            validateStatus: (status) => status < 400
        });

        return {
            html: response.data,
            headers: response.headers,
            status: response.status,
            url: response.request.res.responseUrl || url
        };
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            if (status === 403) {
                throw new Error(`Access denied (403): The website "${new URL(url).hostname}" is blocking automated requests. This is common for sites with bot protection.`);
            } else if (status === 429) {
                throw new Error(`Rate limited (429): The website "${new URL(url).hostname}" is limiting requests. Please try again later.`);
            } else if (status === 404) {
                throw new Error(`Page not found (404): The URL "${url}" does not exist.`);
            } else if (status === 500) {
                throw new Error(`Server error (500): The website "${new URL(url).hostname}" is experiencing technical difficulties.`);
            } else {
                throw new Error(`HTTP ${status}: Unable to fetch "${url}". Server returned status ${status}.`);
            }
        } else if (error.code === 'ENOTFOUND') {
            throw new Error(`Domain not found: "${new URL(url).hostname}" could not be resolved. Please check the URL.`);
        } else if (error.code === 'ECONNREFUSED') {
            throw new Error(`Connection refused: Unable to connect to "${new URL(url).hostname}". The server may be down.`);
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            throw new Error(`Timeout: "${new URL(url).hostname}" took too long to respond. The server may be slow or overloaded.`);
        } else {
            throw new Error(`Network error: Failed to fetch "${url}". ${error.message}`);
        }
    }
}

// AI Agent Accessibility Analysis (async — makes HTTP calls for robots.txt, llms.txt, sitemap)
async function analyzeAIAccessibility(url, html) {
    const checks = [];
    let score = 0;
    const { protocol, host } = new URL(url);
    const baseUrl = `${protocol}//${host}`;

    // Robots.txt — general crawl access + AI-specific bot directives
    const AI_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'GoogleExtended', 'Applebot-Extended', 'anthropic-ai', 'CCBot'];
    try {
        const robotsUrl = `${baseUrl}/robots.txt`;
        const robotsResponse = await axios.get(robotsUrl, { timeout: 5000 });
        const robotsTxt = robotsResponse.data;
        const robots = robotsParser(robotsUrl, robotsTxt);

        if (robots.isAllowed('*', url)) {
            checks.push({
                name: 'Robots.txt Accessibility',
                status: 'pass',
                description: 'Website allows general crawling by automated agents'
            });
            score += 15;
        } else {
            checks.push({
                name: 'Robots.txt Accessibility',
                status: 'warning',
                description: 'Some crawling restrictions found in robots.txt'
            });
            score += 8;
        }

        const blockedBots = AI_BOTS.filter(bot => {
            const pattern = new RegExp(`User-agent:\\s*${bot}`, 'i');
            if (!pattern.test(robotsTxt)) return false;
            return !robots.isAllowed(bot, url);
        });
        const allowedBots = AI_BOTS.filter(bot => {
            const pattern = new RegExp(`User-agent:\\s*${bot}`, 'i');
            return pattern.test(robotsTxt) && robots.isAllowed(bot, url);
        });

        if (blockedBots.length === 0 && allowedBots.length === 0) {
            checks.push({
                name: 'AI Bot Directives',
                status: 'warning',
                description: `No explicit AI bot rules found. Consider adding directives for: ${AI_BOTS.slice(0, 3).join(', ')} and others`
            });
            score += 8;
        } else if (blockedBots.length > 0) {
            checks.push({
                name: 'AI Bot Directives',
                status: 'fail',
                description: `Blocking ${blockedBots.length} AI crawler(s): ${blockedBots.join(', ')}. This prevents AI agents from indexing your content`
            });
        } else {
            checks.push({
                name: 'AI Bot Directives',
                status: 'pass',
                description: `Explicitly allows AI crawlers: ${allowedBots.join(', ')}`
            });
            score += 20;
        }
    } catch (error) {
        checks.push({
            name: 'Robots.txt Accessibility',
            status: 'warning',
            description: 'No robots.txt found or inaccessible'
        });
        score += 8;
        checks.push({
            name: 'AI Bot Directives',
            status: 'warning',
            description: 'Cannot check AI bot directives — robots.txt is missing'
        });
        score += 5;
    }

    // llms.txt check
    try {
        const llmsTxtUrl = `${baseUrl}/llms.txt`;
        const llmsResponse = await axios.get(llmsTxtUrl, { timeout: 5000 });
        const llmsTxt = llmsResponse.data || '';
        const hasContent = llmsTxt.trim().length > 50;
        checks.push({
            name: 'llms.txt',
            status: hasContent ? 'pass' : 'warning',
            description: hasContent
                ? 'llms.txt found — site provides LLM-friendly content guidance'
                : 'llms.txt exists but appears to have minimal content'
        });
        score += hasContent ? 20 : 10;
    } catch (error) {
        checks.push({
            name: 'llms.txt',
            status: 'fail',
            description: 'No llms.txt found. This emerging standard helps LLMs discover and understand your content. See llmstxt.org'
        });
    }

    // noai / noimageai meta tag check
    const $ = cheerio.load(html);
    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    const hasNoAI = /noai|noimageai/i.test(robotsMeta);

    if (hasNoAI) {
        const blocked = [];
        if (/\bnoai\b/i.test(robotsMeta)) blocked.push('noai');
        if (/\bnoimageai\b/i.test(robotsMeta)) blocked.push('noimageai');
        checks.push({
            name: 'AI Content Usage Tags',
            status: 'warning',
            description: `Meta tag(s) found blocking AI usage: ${blocked.join(', ')}. This may prevent LLMs from citing or using your content`
        });
        score += 5;
    } else {
        checks.push({
            name: 'AI Content Usage Tags',
            status: 'pass',
            description: 'No noai/noimageai meta tags found — content is available for AI use'
        });
        score += 15;
    }

    // Content accessibility without JavaScript
    const textContent = $('body').text().trim();
    if (textContent.length > 500) {
        checks.push({ name: 'Content Without JavaScript', status: 'pass', description: 'Substantial content available without JavaScript execution' });
        score += 15;
    } else if (textContent.length > 100) {
        checks.push({ name: 'Content Without JavaScript', status: 'warning', description: 'Limited content available without JavaScript' });
        score += 8;
    } else {
        checks.push({ name: 'Content Without JavaScript', status: 'fail', description: 'Very little content accessible without JavaScript' });
    }

    // Sitemap check
    try {
        const sitemapUrl = `${baseUrl}/sitemap.xml`;
        await axios.head(sitemapUrl, { timeout: 5000 });
        checks.push({ name: 'XML Sitemap', status: 'pass', description: 'XML sitemap found, helping AI agents discover content' });
        score += 15;
    } catch (error) {
        checks.push({ name: 'XML Sitemap', status: 'warning', description: 'No XML sitemap found at standard location' });
        score += 5;
    }

    return { checks, score: Math.min(score, 100) };
}

// Routes

// Homepage route
app.get('/', (req, res) => {
    const apiBaseUrl = NODE_ENV === 'production'
        ? `${getRequestProtocol(req)}://${req.get('host')}`
        : `http://localhost:${PORT}`;

    res.render('index', {
        pageTitle: 'AIO Ready - Website AI Optimization Audit',
        appName: 'AIO Ready',
        appDescription: 'Audit your website\'s readiness for AI optimization',
        version: '1.0.0',
        apiBaseUrl,
        isDevelopment: NODE_ENV === 'development',
        defaultUrl: '',
        showFooter: true
    });
});

// About page route
app.get('/about', (req, res) => {
    res.render('about', {
        pageTitle: 'About AIO Ready',
        appName: 'AIO Ready',
        version: '1.0.0'
    });
});

// API Documentation route
app.get('/api/docs', (req, res) => {
    res.render('api-docs', {
        pageTitle: 'API Documentation - AIO Ready',
        appName: 'AIO Ready',
        version: '1.0.0',
        baseUrl: req.protocol + '://' + req.get('host')
    });
});

// Contact page route
app.get('/contact', (req, res) => {
    res.render('contact', {
        pageTitle: 'Contact - AIO Ready',
        appName: 'AIO Ready',
        version: '1.0.0'
    });
});

// Main audit endpoint
app.post('/api/audit', auditRateLimit, async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || !validator.isURL(url)) {
            return res.status(400).json({
                error: 'Invalid URL provided',
                message: 'Please provide a valid URL starting with http:// or https://'
            });
        }

        let pageData;
        let fetchError = null;

        try {
            pageData = await fetchPageContent(url);
        } catch (error) {
            fetchError = error;
            console.error('Fetch error:', error.message);
            return res.status(200).json({
                success: true,
                audit: generateLimitedAudit(url, fetchError),
                recommendations: generateFetchErrorRecommendations(fetchError),
                warning: 'Limited analysis due to access restrictions',
                error: error.message
            });
        }

        const [contentStructure, aiAccessibility, dataQuality, performance, structuredData, socialMedia, accessibility, security] = await Promise.all([
            analyzeContentStructure(pageData.html, url),
            analyzeAIAccessibility(url, pageData.html),
            analyzeDataQuality(pageData.html, url),
            analyzePerformance(url, pageData.headers, pageData.html),
            analyzeStructuredData(pageData.html, url),
            analyzeSocialMedia(pageData.html, url),
            analyzeAccessibility(pageData.html, url),
            analyzeSecurity(pageData.html, url, pageData.headers)
        ]);

        const scores = [
            contentStructure.score,
            aiAccessibility.score,
            dataQuality.score,
            performance.score,
            structuredData.score,
            socialMedia.score,
            accessibility.score,
            security.score
        ];

        const overallScore = Math.round(
            scores.reduce((sum, score) => sum + score, 0) / scores.length
        );

        const auditResults = {
            url: pageData.url,
            domain: new URL(url).hostname,
            timestamp: new Date().toISOString(),
            overallScore,
            sections: {
                contentStructure: { title: 'Content Structure & Markup', score: contentStructure.score, checks: contentStructure.checks },
                aiAccessibility: { title: 'AI Agent Accessibility', score: aiAccessibility.score, checks: aiAccessibility.checks },
                dataQuality: { title: 'Data Quality & Format', score: dataQuality.score, checks: dataQuality.checks },
                performance: { title: 'Performance & Speed', score: performance.score, checks: performance.checks },
                structuredData: { title: 'Structured Data & Schema', score: structuredData.score, checks: structuredData.checks },
                socialMedia: { title: 'Social Media & Sharing', score: socialMedia.score, checks: socialMedia.checks },
                accessibility: { title: 'Accessibility & Usability', score: accessibility.score, checks: accessibility.checks },
                security: { title: 'Security & Privacy', score: security.score, checks: security.checks }
            }
        };

        const recommendations = generateRecommendations(auditResults);

        res.json({ success: true, audit: auditResults, recommendations });

    } catch (error) {
        console.error('Audit error:', error);
        res.status(500).json({
            error: 'Failed to complete audit',
            message: error.message,
            suggestion: 'Please try again with a different URL or check if the website is accessible.'
        });
    }
});

// Generate limited audit for sites that block access
function generateLimitedAudit(url, fetchError) {
    const domain = new URL(url).hostname;
    const isHttps = url.startsWith('https://');

    return {
        url: url,
        domain: domain,
        timestamp: new Date().toISOString(),
        overallScore: 'N/A',
        limited: true,
        sections: {
            contentStructure: {
                title: 'Content Structure & Markup',
                score: 'N/A',
                checks: [{ name: 'Content Access', status: 'fail', description: 'Unable to access website content for analysis' }]
            },
            aiAccessibility: {
                title: 'AI Agent Accessibility',
                score: fetchError.message.includes('403') ? 20 : 50,
                checks: [
                    {
                        name: 'Bot Access',
                        status: fetchError.message.includes('403') ? 'fail' : 'warning',
                        description: fetchError.message.includes('403')
                            ? 'Website blocks automated access - AI agents may be restricted'
                            : 'Access issues detected - may impact AI agent crawling'
                    },
                    {
                        name: 'Domain Resolution',
                        status: fetchError.message.includes('ENOTFOUND') ? 'fail' : 'pass',
                        description: fetchError.message.includes('ENOTFOUND')
                            ? 'Domain cannot be resolved'
                            : 'Domain resolves correctly'
                    }
                ]
            },
            dataQuality: {
                title: 'Data Quality & Format',
                score: 'N/A',
                checks: [{ name: 'Content Analysis', status: 'fail', description: 'Cannot analyze content quality - access blocked' }]
            },
            performance: {
                title: 'Performance & Speed',
                score: isHttps ? 50 : 25,
                checks: [
                    {
                        name: 'HTTPS Security',
                        status: isHttps ? 'pass' : 'fail',
                        description: isHttps ? 'Website uses secure HTTPS protocol' : 'Website does not use HTTPS - security risk'
                    },
                    { name: 'Accessibility', status: 'fail', description: 'Unable to test performance - access blocked' }
                ]
            }
        }
    };
}

// Generate recommendations for fetch errors
function generateFetchErrorRecommendations(fetchError) {
    const recommendations = [];

    if (fetchError.message.includes('403')) {
        recommendations.push({
            priority: 'high',
            title: 'Remove Bot Blocking',
            description: 'Your website is blocking automated access, which will prevent AI agents from crawling and indexing your content. Consider allowing legitimate bot access through robots.txt.',
            impact: 'High - AI agents cannot access your content'
        });
        recommendations.push({
            priority: 'medium',
            title: 'Implement Proper Bot Detection',
            description: 'Instead of blocking all automated requests, implement proper bot detection that allows legitimate crawlers while blocking malicious bots.',
            impact: 'Medium - Improves accessibility for beneficial AI agents'
        });
    }

    if (fetchError.message.includes('timeout') || fetchError.message.includes('ETIMEDOUT')) {
        recommendations.push({
            priority: 'high',
            title: 'Improve Server Response Time',
            description: 'Your website is taking too long to respond. Optimize server performance to ensure AI agents can crawl your content efficiently.',
            impact: 'High - Slow responses hurt AI crawling efficiency'
        });
    }

    recommendations.push({
        priority: 'low',
        title: 'Test Website Accessibility',
        description: 'Manually test your website to ensure it\'s accessible and functioning properly. Consider using tools like curl or wget to test automated access.',
        impact: 'Low - General troubleshooting step'
    });

    return recommendations;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        environment: NODE_ENV
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', {
        pageTitle: 'Page Not Found - AIO Ready',
        appName: 'AIO Ready',
        version: '1.0.0'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        pageTitle: 'Error - AIO Ready',
        appName: 'AIO Ready',
        error: NODE_ENV === 'development' ? err : { message: 'Something went wrong!' },
        version: '1.0.0'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`AIO Audit Server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`API docs: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
