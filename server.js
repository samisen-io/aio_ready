// package.json dependencies needed:
// npm install express cors helmet morgan compression dotenv ejs
// npm install axios cheerio robots-parser lighthouse chrome-launcher
// npm install validator url-parse path puppeteer

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const validator = require('validator');
const urlParse = require('url-parse');
const { PageDataExtractor } = require('./services/llmOptimizer/pageDataExtractor');
const { AnthropicClient } = require('./services/llmOptimizer/anthropicClient');
const { MarkupService } = require('./services/llmOptimizer/markupService');
const { createLlmOptimizerRouter } = require('./routes/llmOptimizer');
require('dotenv').config();

const app = express();
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
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));
app.use(cors());
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

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map();

const rateLimit = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 10;

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }

    const userData = rateLimitMap.get(ip);
    if (now > userData.resetTime) {
        userData.count = 1;
        userData.resetTime = now + windowMs;
        return next();
    }

    if (userData.count >= maxRequests) {
        return res.status(429).json({
            error: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((userData.resetTime - now) / 1000)
        });
    }

    userData.count++;
    next();
};

// Helper function to fetch page content with better error handling
async function fetchPageContent(url, timeout = 10000) {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
        // Enhanced error handling with specific messages
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

// Content Structure & Markup Analysis
function analyzeContentStructure(html, url) {
    const $ = cheerio.load(html);
    const checks = [];
    let score = 0;

    // Semantic HTML check
    const semanticElements = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
    const foundSemantic = semanticElements.filter(el => $(el).length > 0);
    if (foundSemantic.length >= 3) {
        checks.push({
            name: 'Semantic HTML Usage',
            status: 'pass',
            description: `Found ${foundSemantic.length} semantic elements: ${foundSemantic.join(', ')}`
        });
        score += 25;
    } else {
        checks.push({
            name: 'Semantic HTML Usage',
            status: 'fail',
            description: `Only found ${foundSemantic.length} semantic elements. Consider using more HTML5 semantic tags.`
        });
    }

    // Heading hierarchy check
    const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const foundHeadings = headings.map(h => $(h).length).filter(count => count > 0);
    const hasH1 = $('h1').length === 1;
    
    if (hasH1 && foundHeadings.length >= 2) {
        checks.push({
            name: 'Heading Hierarchy',
            status: 'pass',
            description: 'Proper heading structure with single H1 and multiple heading levels'
        });
        score += 25;
    } else if (hasH1) {
        checks.push({
            name: 'Heading Hierarchy',
            status: 'warning',
            description: 'Has H1 but limited heading hierarchy'
        });
        score += 15;
    } else {
        checks.push({
            name: 'Heading Hierarchy',
            status: 'fail',
            description: 'Missing or multiple H1 tags, poor heading structure'
        });
    }

    // Meta description check
    const metaDescription = $('meta[name="description"]').attr('content');
    if (metaDescription && metaDescription.length >= 120 && metaDescription.length <= 160) {
        checks.push({
            name: 'Meta Description',
            status: 'pass',
            description: `Well-optimized meta description (${metaDescription.length} characters)`
        });
        score += 25;
    } else if (metaDescription) {
        checks.push({
            name: 'Meta Description',
            status: 'warning',
            description: `Meta description present but not optimal length (${metaDescription.length} characters)`
        });
        score += 15;
    } else {
        checks.push({
            name: 'Meta Description',
            status: 'fail',
            description: 'Missing meta description'
        });
    }

    // Structured data check
    const jsonLd = $('script[type="application/ld+json"]').length;
    const microdata = $('[itemscope]').length;
    const openGraph = $('meta[property^="og:"]').length;
    
    if (jsonLd > 0 || microdata > 0) {
        checks.push({
            name: 'Structured Data',
            status: 'pass',
            description: `Found structured data: ${jsonLd} JSON-LD, ${microdata} microdata items`
        });
        score += 25;
    } else if (openGraph > 0) {
        checks.push({
            name: 'Structured Data',
            status: 'warning',
            description: 'Has Open Graph tags but no Schema.org markup'
        });
        score += 10;
    } else {
        checks.push({
            name: 'Structured Data',
            status: 'fail',
            description: 'No structured data found (JSON-LD, microdata, or extensive Open Graph)'
        });
    }

    return { checks, score: Math.min(score, 100) };
}

// AI Agent Accessibility Analysis
async function analyzeAIAccessibility(url, html) {
    const checks = [];
    let score = 0;
    const parsedUrl = urlParse(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // Robots.txt check
    try {
        const robotsUrl = `${baseUrl}/robots.txt`;
        const robotsResponse = await axios.get(robotsUrl, { timeout: 5000 });
        const robots = robotsParser(robotsUrl, robotsResponse.data);
        
        if (robots.isAllowed('*', url)) {
            checks.push({
                name: 'Robots.txt Accessibility',
                status: 'pass',
                description: 'Website allows crawling by AI agents'
            });
            score += 25;
        } else {
            checks.push({
                name: 'Robots.txt Accessibility',
                status: 'warning',
                description: 'Some crawling restrictions found'
            });
            score += 15;
        }
    } catch (error) {
        checks.push({
            name: 'Robots.txt Accessibility',
            status: 'warning',
            description: 'No robots.txt found or inaccessible'
        });
        score += 10;
    }

    // Content accessibility without JavaScript
    const $ = cheerio.load(html);
    const textContent = $('body').text().trim();
    
    if (textContent.length > 500) {
        checks.push({
            name: 'Content Without JavaScript',
            status: 'pass',
            description: 'Substantial content available without JavaScript execution'
        });
        score += 25;
    } else if (textContent.length > 100) {
        checks.push({
            name: 'Content Without JavaScript',
            status: 'warning',
            description: 'Limited content available without JavaScript'
        });
        score += 15;
    } else {
        checks.push({
            name: 'Content Without JavaScript',
            status: 'fail',
            description: 'Very little content accessible without JavaScript'
        });
    }

    // Sitemap check
    try {
        const sitemapUrl = `${baseUrl}/sitemap.xml`;
        await axios.head(sitemapUrl, { timeout: 5000 });
        checks.push({
            name: 'XML Sitemap',
            status: 'pass',
            description: 'XML sitemap found, helping AI agents discover content'
        });
        score += 25;
    } catch (error) {
        checks.push({
            name: 'XML Sitemap',
            status: 'warning',
            description: 'No XML sitemap found at standard location'
        });
        score += 10;
    }

    // API documentation check
    const hasApiDocs = html.toLowerCase().includes('api') && 
                      (html.toLowerCase().includes('documentation') || 
                       html.toLowerCase().includes('docs') ||
                       html.toLowerCase().includes('swagger') ||
                       html.toLowerCase().includes('openapi'));
    
    if (hasApiDocs) {
        checks.push({
            name: 'API Documentation',
            status: 'pass',
            description: 'API documentation appears to be available'
        });
        score += 25;
    } else {
        checks.push({
            name: 'API Documentation',
            status: 'fail',
            description: 'No clear API documentation found'
        });
    }

    return { checks, score: Math.min(score, 100) };
}

// Data Quality Analysis
function analyzeDataQuality(html, url) {
    const $ = cheerio.load(html);
    const checks = [];
    let score = 0;

    // Content format and readability
    const paragraphs = $('p').length;
    const lists = $('ul, ol').length;
    const textLength = $('body').text().length;
    
    if (paragraphs >= 3 && textLength > 1000) {
        checks.push({
            name: 'Content Format Quality',
            status: 'pass',
            description: `Well-structured content with ${paragraphs} paragraphs and ${lists} lists`
        });
        score += 25;
    } else if (paragraphs >= 1 && textLength > 300) {
        checks.push({
            name: 'Content Format Quality',
            status: 'warning',
            description: 'Basic content structure present but could be improved'
        });
        score += 15;
    } else {
        checks.push({
            name: 'Content Format Quality',
            status: 'fail',
            description: 'Poor content structure and limited text content'
        });
    }

    // Image alt text check
    const images = $('img');
    const imagesWithAlt = $('img[alt]');
    const imagesWithGoodAlt = $('img[alt]').filter((i, el) => $(el).attr('alt').length > 3);
    
    if (images.length === 0) {
        checks.push({
            name: 'Image Optimization',
            status: 'pass',
            description: 'No images found to optimize'
        });
        score += 25;
    } else if (imagesWithGoodAlt.length === images.length) {
        checks.push({
            name: 'Image Optimization',
            status: 'pass',
            description: `All ${images.length} images have descriptive alt text`
        });
        score += 25;
    } else if (imagesWithAlt.length >= images.length * 0.7) {
        checks.push({
            name: 'Image Optimization',
            status: 'warning',
            description: `${imagesWithAlt.length}/${images.length} images have alt text`
        });
        score += 15;
    } else {
        checks.push({
            name: 'Image Optimization',
            status: 'fail',
            description: `Only ${imagesWithAlt.length}/${images.length} images have alt text`
        });
    }

    // Contact information check
    const hasContactInfo = html.toLowerCase().includes('contact') ||
                          html.toLowerCase().includes('email') ||
                          html.toLowerCase().includes('@') ||
                          html.toLowerCase().includes('phone');
    
    if (hasContactInfo) {
        checks.push({
            name: 'Contact Information',
            status: 'pass',
            description: 'Contact information appears to be available'
        });
        score += 25;
    } else {
        checks.push({
            name: 'Contact Information',
            status: 'warning',
            description: 'Limited or no clear contact information found'
        });
        score += 10;
    }

    // Content consistency check
    const title = $('title').text();
    const h1Text = $('h1').first().text();
    const isConsistent = title && h1Text && 
                        (title.toLowerCase().includes(h1Text.toLowerCase()) ||
                         h1Text.toLowerCase().includes(title.toLowerCase()));
    
    if (isConsistent) {
        checks.push({
            name: 'Content Consistency',
            status: 'pass',
            description: 'Title and main heading are consistent'
        });
        score += 25;
    } else {
        checks.push({
            name: 'Content Consistency',
            status: 'warning',
            description: 'Title and main heading may not be well-aligned'
        });
        score += 10;
    }

    return { checks, score: Math.min(score, 100) };
}

// Performance Analysis
async function analyzePerformance(url, headers, html) {
    const checks = [];
    let score = 0;

    // HTTPS check
    if (url.startsWith('https://')) {
        checks.push({
            name: 'HTTPS Security',
            status: 'pass',
            description: 'Website uses secure HTTPS protocol'
        });
        score += 25;
    } else {
        checks.push({
            name: 'HTTPS Security',
            status: 'fail',
            description: 'Website does not use HTTPS - security risk for AI agents'
        });
    }

    // Mobile responsiveness check
    const $ = cheerio.load(html);
    const viewport = $('meta[name="viewport"]').attr('content');
    const hasResponsiveElements = html.includes('responsive') || 
                                 html.includes('@media') ||
                                 html.includes('mobile');
    
    if (viewport && hasResponsiveElements) {
        checks.push({
            name: 'Mobile Responsiveness',
            status: 'pass',
            description: 'Website appears to be mobile-responsive'
        });
        score += 25;
    } else if (viewport) {
        checks.push({
            name: 'Mobile Responsiveness',
            status: 'warning',
            description: 'Viewport meta tag present but limited responsive indicators'
        });
        score += 15;
    } else {
        checks.push({
            name: 'Mobile Responsiveness',
            status: 'fail',
            description: 'No viewport meta tag found - likely not mobile responsive'
        });
    }

    // Compression check
    const contentEncoding = headers['content-encoding'];
    if (contentEncoding && (contentEncoding.includes('gzip') || contentEncoding.includes('br'))) {
        checks.push({
            name: 'Content Compression',
            status: 'pass',
            description: `Content is compressed using ${contentEncoding}`
        });
        score += 25;
    } else {
        checks.push({
            name: 'Content Compression',
            status: 'warning',
            description: 'Content compression not detected - may impact load times'
        });
        score += 10;
    }

    // Caching headers check
    const cacheControl = headers['cache-control'];
    const etag = headers['etag'];
    const expires = headers['expires'];
    
    if (cacheControl || etag || expires) {
        checks.push({
            name: 'Caching Strategy',
            status: 'pass',
            description: 'Caching headers present to optimize repeated requests'
        });
        score += 25;
    } else {
        checks.push({
            name: 'Caching Strategy',
            status: 'warning',
            description: 'No caching headers found - may impact performance'
        });
        score += 10;
    }

    return { checks, score: Math.min(score, 100) };
}

// Advanced Structured Data Analysis
function analyzeStructuredData(html, url) {
    const $ = cheerio.load(html);
    const checks = [];
    let score = 0;
    let structuredDataCount = 0;
    let schemaTypes = new Set();

    // JSON-LD analysis
    const jsonLdScripts = $('script[type="application/ld+json"]');
    jsonLdScripts.each((i, el) => {
        try {
            const jsonData = JSON.parse($(el).html());
            if (Array.isArray(jsonData)) {
                jsonData.forEach(item => {
                    if (item['@type']) {
                        schemaTypes.add(item['@type']);
                        structuredDataCount++;
                    }
                });
            } else if (jsonData['@type']) {
                schemaTypes.add(jsonData['@type']);
                structuredDataCount++;
            }
        } catch (e) {
            // Invalid JSON-LD
        }
    });

    // Microdata analysis
    const microdataItems = $('[itemscope]');
    microdataItems.each((i, el) => {
        const itemType = $(el).attr('itemtype');
        if (itemType) {
            const type = itemType.split('/').pop();
            schemaTypes.add(type);
            structuredDataCount++;
        }
    });

    // Open Graph analysis
    const openGraphTags = $('meta[property^="og:"]');
    const hasOpenGraph = openGraphTags.length > 0;
    const essentialOGTags = ['og:title', 'og:description', 'og:image', 'og:url'];
    const foundOGTags = essentialOGTags.filter(tag => 
        openGraphTags.filter((i, el) => $(el).attr('property') === tag).length > 0
    );

    // Twitter Card analysis
    const twitterTags = $('meta[name^="twitter:"]');
    const hasTwitterCards = twitterTags.length > 0;

    // Scoring based on structured data implementation
    if (structuredDataCount >= 3) {
        checks.push({
            name: 'Rich Structured Data',
            status: 'pass',
            description: `Found ${structuredDataCount} structured data items with types: ${Array.from(schemaTypes).join(', ')}`
        });
        score += 30;
    } else if (structuredDataCount >= 1) {
        checks.push({
            name: 'Basic Structured Data',
            status: 'warning',
            description: `Found ${structuredDataCount} structured data items. Consider adding more schema types.`
        });
        score += 15;
    } else {
        checks.push({
            name: 'No Structured Data',
            status: 'fail',
            description: 'No structured data found. This significantly impacts AI understanding.'
        });
    }

    // Open Graph scoring
    if (foundOGTags.length >= 3) {
        checks.push({
            name: 'Open Graph Optimization',
            status: 'pass',
            description: `Well-optimized Open Graph with ${foundOGTags.length}/4 essential tags`
        });
        score += 20;
    } else if (hasOpenGraph) {
        checks.push({
            name: 'Open Graph Optimization',
            status: 'warning',
            description: `Basic Open Graph tags found but missing essential tags`
        });
        score += 10;
    } else {
        checks.push({
            name: 'Open Graph Optimization',
            status: 'fail',
            description: 'No Open Graph tags found - impacts social media sharing'
        });
    }

    // Twitter Cards scoring
    if (hasTwitterCards) {
        checks.push({
            name: 'Twitter Card Optimization',
            status: 'pass',
            description: 'Twitter Card meta tags present for better social sharing'
        });
        score += 15;
    } else {
        checks.push({
            name: 'Twitter Card Optimization',
            status: 'warning',
            description: 'No Twitter Card tags found - consider adding for better social media presence'
        });
        score += 5;
    }

    // Schema.org specific checks
    const importantSchemas = ['Organization', 'WebSite', 'Article', 'Product', 'LocalBusiness'];
    const foundImportantSchemas = importantSchemas.filter(schema => 
        Array.from(schemaTypes).some(type => type.includes(schema))
    );

    if (foundImportantSchemas.length >= 2) {
        checks.push({
            name: 'Schema.org Implementation',
            status: 'pass',
            description: `Found important schemas: ${foundImportantSchemas.join(', ')}`
        });
        score += 20;
    } else if (foundImportantSchemas.length >= 1) {
        checks.push({
            name: 'Schema.org Implementation',
            status: 'warning',
            description: `Found ${foundImportantSchemas.length} important schema(s). Consider adding more.`
        });
        score += 10;
    } else {
        checks.push({
            name: 'Schema.org Implementation',
            status: 'fail',
            description: 'No important Schema.org types found. Add Organization and WebSite schemas.'
        });
    }

    return { checks, score: Math.min(score, 100) };
}

// Social Media and Sharing Analysis
function analyzeSocialMedia(html, url) {
    const $ = cheerio.load(html);
    const checks = [];
    let score = 0;

    // Social media links detection
    const socialPlatforms = {
        'facebook.com': 'Facebook',
        'twitter.com': 'Twitter',
        'linkedin.com': 'LinkedIn',
        'instagram.com': 'Instagram',
        'youtube.com': 'YouTube',
        'github.com': 'GitHub'
    };

    const socialLinks = [];
    $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"], a[href*="youtube.com"], a[href*="github.com"]').each((i, el) => {
        const href = $(el).attr('href');
        for (const [domain, platform] of Object.entries(socialPlatforms)) {
            if (href.includes(domain)) {
                socialLinks.push(platform);
                break;
            }
        }
    });

    if (socialLinks.length >= 3) {
        checks.push({
            name: 'Social Media Presence',
            status: 'pass',
            description: `Strong social media presence with links to: ${socialLinks.join(', ')}`
        });
        score += 25;
    } else if (socialLinks.length >= 1) {
        checks.push({
            name: 'Social Media Presence',
            status: 'warning',
            description: `Limited social media presence: ${socialLinks.join(', ')}`
        });
        score += 15;
    } else {
        checks.push({
            name: 'Social Media Presence',
            status: 'fail',
            description: 'No social media links found - consider adding social profiles'
        });
    }

    // Social sharing buttons
    const sharingButtons = $('a[href*="share"], a[href*="tweet"], .share, .social-share, [class*="share"]');
    if (sharingButtons.length > 0) {
        checks.push({
            name: 'Social Sharing',
            status: 'pass',
            description: 'Social sharing functionality detected'
        });
        score += 25;
    } else {
        checks.push({
            name: 'Social Sharing',
            status: 'warning',
            description: 'No social sharing buttons found - consider adding share functionality'
        });
        score += 10;
    }

    // RSS feed detection
    const rssLinks = $('link[type="application/rss+xml"], link[type="application/atom+xml"]');
    if (rssLinks.length > 0) {
        checks.push({
            name: 'RSS/Atom Feeds',
            status: 'pass',
            description: 'RSS/Atom feeds available for content syndication'
        });
        score += 25;
    } else {
        checks.push({
            name: 'RSS/Atom Feeds',
            status: 'warning',
            description: 'No RSS/Atom feeds found - consider adding for content distribution'
        });
        score += 10;
    }

    // Email sharing
    const emailLinks = $('a[href^="mailto:"]');
    if (emailLinks.length > 0) {
        checks.push({
            name: 'Email Sharing',
            status: 'pass',
            description: 'Email sharing functionality available'
        });
        score += 25;
    } else {
        checks.push({
            name: 'Email Sharing',
            status: 'warning',
            description: 'No email sharing links found'
        });
        score += 10;
    }

    return { checks, score: Math.min(score, 100) };
}

// Accessibility Analysis
function analyzeAccessibility(html, url) {
    const $ = cheerio.load(html);
    const checks = [];
    let score = 0;

    // ARIA labels and roles
    const ariaElements = $('[aria-label], [aria-labelledby], [role]');
    const hasAriaLabels = $('[aria-label]').length > 0;
    const hasRoles = $('[role]').length > 0;

    if (ariaElements.length >= 5) {
        checks.push({
            name: 'ARIA Implementation',
            status: 'pass',
            description: `Good ARIA implementation with ${ariaElements.length} ARIA attributes`
        });
        score += 25;
    } else if (ariaElements.length >= 1) {
        checks.push({
            name: 'ARIA Implementation',
            status: 'warning',
            description: `Basic ARIA implementation with ${ariaElements.length} attributes`
        });
        score += 15;
    } else {
        checks.push({
            name: 'ARIA Implementation',
            status: 'fail',
            description: 'No ARIA attributes found - important for accessibility'
        });
    }

    // Form accessibility
    const forms = $('form');
    const formsWithLabels = forms.filter((i, form) => {
        const inputs = $(form).find('input, select, textarea');
        return inputs.length === 0 || inputs.filter((j, input) => {
            const id = $(input).attr('id');
            return id && $(`label[for="${id}"]`).length > 0;
        }).length === inputs.length;
    });

    if (forms.length === 0) {
        checks.push({
            name: 'Form Accessibility',
            status: 'pass',
            description: 'No forms found to test'
        });
        score += 25;
    } else if (formsWithLabels.length === forms.length) {
        checks.push({
            name: 'Form Accessibility',
            status: 'pass',
            description: 'All forms have proper label associations'
        });
        score += 25;
    } else {
        checks.push({
            name: 'Form Accessibility',
            status: 'warning',
            description: `${formsWithLabels.length}/${forms.length} forms have proper labels`
        });
        score += 15;
    }

    // Color contrast and semantic markup
    const semanticElements = $('header, nav, main, article, section, aside, footer, h1, h2, h3, h4, h5, h6');
    if (semanticElements.length >= 8) {
        checks.push({
            name: 'Semantic Markup',
            status: 'pass',
            description: `Good semantic structure with ${semanticElements.length} semantic elements`
        });
        score += 25;
    } else if (semanticElements.length >= 4) {
        checks.push({
            name: 'Semantic Markup',
            status: 'warning',
            description: `Basic semantic structure with ${semanticElements.length} elements`
        });
        score += 15;
    } else {
        checks.push({
            name: 'Semantic Markup',
            status: 'fail',
            description: 'Limited semantic markup - important for screen readers'
        });
    }

    // Skip links and navigation
    const skipLinks = $('a[href^="#"], a[href*="skip"], a[href*="nav"]');
    const hasMainNavigation = $('nav').length > 0;
    
    if (hasMainNavigation && skipLinks.length > 0) {
        checks.push({
            name: 'Navigation Accessibility',
            status: 'pass',
            description: 'Good navigation structure with skip links'
        });
        score += 25;
    } else if (hasMainNavigation) {
        checks.push({
            name: 'Navigation Accessibility',
            status: 'warning',
            description: 'Has navigation but could benefit from skip links'
        });
        score += 15;
    } else {
        checks.push({
            name: 'Navigation Accessibility',
            status: 'fail',
            description: 'No clear navigation structure found'
        });
    }

    return { checks, score: Math.min(score, 100) };
}

// Security Analysis
function analyzeSecurity(html, url, headers) {
    const checks = [];
    let score = 0;

    // HTTPS check (already in performance, but important for security)
    if (url.startsWith('https://')) {
        checks.push({
            name: 'HTTPS Implementation',
            status: 'pass',
            description: 'Website uses secure HTTPS protocol'
        });
        score += 25;
    } else {
        checks.push({
            name: 'HTTPS Implementation',
            status: 'fail',
            description: 'Website does not use HTTPS - major security risk'
        });
    }

    // Security headers
    const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000',
        'Content-Security-Policy': 'default-src \'self\''
    };

    let foundHeaders = 0;
    Object.entries(securityHeaders).forEach(([header, expectedValue]) => {
        const headerValue = headers[header.toLowerCase()];
        if (headerValue) {
            foundHeaders++;
        }
    });

    if (foundHeaders >= 4) {
        checks.push({
            name: 'Security Headers',
            status: 'pass',
            description: `Strong security headers: ${foundHeaders}/5 implemented`
        });
        score += 25;
    } else if (foundHeaders >= 2) {
        checks.push({
            name: 'Security Headers',
            status: 'warning',
            description: `Basic security headers: ${foundHeaders}/5 implemented`
        });
        score += 15;
    } else {
        checks.push({
            name: 'Security Headers',
            status: 'fail',
            description: 'Missing important security headers'
        });
    }

    // External resource security
    const $ = cheerio.load(html);
    const externalScripts = $('script[src^="http://"]');
    const externalStyles = $('link[href^="http://"]');
    
    if (externalScripts.length === 0 && externalStyles.length === 0) {
        checks.push({
            name: 'External Resource Security',
            status: 'pass',
            description: 'No insecure external resources loaded'
        });
        score += 25;
    } else {
        const insecureCount = externalScripts.length + externalStyles.length;
        checks.push({
            name: 'External Resource Security',
            status: 'warning',
            description: `${insecureCount} external resources loaded over HTTP`
        });
        score += 10;
    }

    // Form security
    const forms = $('form');
    const formsWithCSRF = forms.filter((i, form) => {
        return $(form).find('input[name*="csrf"], input[name*="token"], input[type="hidden"]').length > 0;
    });

    if (forms.length === 0) {
        checks.push({
            name: 'Form Security',
            status: 'pass',
            description: 'No forms found to test'
        });
        score += 25;
    } else if (formsWithCSRF.length === forms.length) {
        checks.push({
            name: 'Form Security',
            status: 'pass',
            description: 'All forms appear to have CSRF protection'
        });
        score += 25;
    } else {
        checks.push({
            name: 'Form Security',
            status: 'warning',
            description: `${formsWithCSRF.length}/${forms.length} forms have security tokens`
        });
        score += 15;
    }

    return { checks, score: Math.min(score, 100) };
}

// Advanced JavaScript Analysis using Puppeteer (optional)
async function analyzeJavaScriptContent(url) {
    const checks = [];
    let score = 0;
    
    try {
        // Only run Puppeteer analysis if the package is available
        let puppeteer;
        try {
            puppeteer = require('puppeteer');
        } catch (e) {
            throw new Error('Puppeteer not available');
        }
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set a reasonable timeout
        await page.setDefaultTimeout(15000);
        
        // Navigate to the page
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // Check for JavaScript errors
        const jsErrors = await page.evaluate(() => {
            return window.jsErrors || [];
        });
        
        if (jsErrors.length === 0) {
            checks.push({
                name: 'JavaScript Errors',
                status: 'pass',
                description: 'No JavaScript errors detected'
            });
            score += 25;
        } else {
            checks.push({
                name: 'JavaScript Errors',
                status: 'warning',
                description: `${jsErrors.length} JavaScript errors detected`
            });
            score += 10;
        }
        
        // Check for dynamic content loading
        const dynamicContent = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const initialText = document.body.textContent;
            return bodyText.length > initialText.length * 1.2;
        });
        
        if (dynamicContent) {
            checks.push({
                name: 'Dynamic Content',
                status: 'pass',
                description: 'Dynamic content loading detected - good for user experience'
            });
            score += 25;
        } else {
            checks.push({
                name: 'Dynamic Content',
                status: 'warning',
                description: 'Limited dynamic content - consider progressive enhancement'
            });
            score += 15;
        }
        
        // Check for service worker
        const hasServiceWorker = await page.evaluate(() => {
            return 'serviceWorker' in navigator;
        });
        
        if (hasServiceWorker) {
            checks.push({
                name: 'Progressive Web App',
                status: 'pass',
                description: 'Service worker detected - PWA capabilities available'
            });
            score += 25;
        } else {
            checks.push({
                name: 'Progressive Web App',
                status: 'warning',
                description: 'No service worker - consider PWA implementation'
            });
            score += 10;
        }
        
        // Check for Web APIs usage
        const webAPIs = await page.evaluate(() => {
            const apis = [];
            if ('localStorage' in window) apis.push('localStorage');
            if ('sessionStorage' in window) apis.push('sessionStorage');
            if ('geolocation' in navigator) apis.push('geolocation');
            if ('pushManager' in window) apis.push('push notifications');
            return apis;
        });
        
        if (webAPIs.length >= 2) {
            checks.push({
                name: 'Modern Web APIs',
                status: 'pass',
                description: `Modern web APIs detected: ${webAPIs.join(', ')}`
            });
            score += 25;
        } else if (webAPIs.length >= 1) {
            checks.push({
                name: 'Modern Web APIs',
                status: 'warning',
                description: `Basic web APIs: ${webAPIs.join(', ')}`
            });
            score += 15;
        } else {
            checks.push({
                name: 'Modern Web APIs',
                status: 'fail',
                description: 'No modern web APIs detected'
            });
        }
        
        await browser.close();
        
    } catch (error) {
        // If Puppeteer is not available or fails, provide basic analysis
        checks.push({
            name: 'JavaScript Analysis',
            status: 'warning',
            description: 'Advanced JavaScript analysis not available - using basic checks'
        });
        score += 10;
    }
    
    return { checks, score: Math.min(score, 100) };
}

// Generate recommendations based on audit results
function generateRecommendations(auditResults) {
    const recommendations = [];
    
    // Check each section for failed items and generate specific recommendations
    Object.values(auditResults.sections).forEach(section => {
        section.checks.forEach(check => {
            if (check.status === 'fail') {
                switch (check.name) {
                    case 'Structured Data':
                        recommendations.push({
                            priority: 'high',
                            title: 'Implement Schema.org Markup',
                            description: 'Add JSON-LD structured data to help AI agents understand your content better. Start with Organization, WebSite, and Article schemas.',
                            impact: 'High - Significantly improves AI content understanding'
                        });
                        break;
                    case 'Image Optimization':
                        recommendations.push({
                            priority: 'medium',
                            title: 'Add Descriptive Alt Text to Images',
                            description: 'Provide meaningful alt text for all images. This helps AI agents understand visual content and improves accessibility.',
                            impact: 'Medium - Enhances content comprehension for AI'
                        });
                        break;
                    case 'HTTPS Security':
                        recommendations.push({
                            priority: 'high',
                            title: 'Enable HTTPS Security',
                            description: 'Migrate to HTTPS to ensure secure connections. AI agents prefer secure endpoints for data exchange.',
                            impact: 'High - Essential for AI agent trust and security'
                        });
                        break;
                    case 'API Documentation':
                        recommendations.push({
                            priority: 'medium',
                            title: 'Create API Documentation',
                            description: 'If you have APIs, document them clearly with OpenAPI/Swagger specs. This enables programmatic AI interactions.',
                            impact: 'Medium - Enables advanced AI integrations'
                        });
                        break;
                    case 'No Structured Data':
                        recommendations.push({
                            priority: 'high',
                            title: 'Implement Schema.org Markup',
                            description: 'Add JSON-LD structured data to help AI agents understand your content better. Start with Organization, WebSite, and Article schemas.',
                            impact: 'High - Significantly improves AI content understanding'
                        });
                        break;
                    case 'Open Graph Optimization':
                        recommendations.push({
                            priority: 'medium',
                            title: 'Optimize Open Graph Tags',
                            description: 'Add complete Open Graph meta tags (og:title, og:description, og:image, og:url) for better social media sharing.',
                            impact: 'Medium - Improves social media presence'
                        });
                        break;
                    case 'ARIA Implementation':
                        recommendations.push({
                            priority: 'medium',
                            title: 'Implement ARIA Attributes',
                            description: 'Add ARIA labels, roles, and descriptions to improve accessibility for screen readers and AI agents.',
                            impact: 'Medium - Enhances accessibility and AI understanding'
                        });
                        break;
                    case 'Security Headers':
                        recommendations.push({
                            priority: 'high',
                            title: 'Implement Security Headers',
                            description: 'Add security headers like X-Content-Type-Options, X-Frame-Options, and Content-Security-Policy.',
                            impact: 'High - Essential for security and AI agent trust'
                        });
                        break;
                }
            }
        });
    });

    // Add general recommendations if score is low
    if (auditResults.overallScore < 70) {
        recommendations.unshift({
            priority: 'high',
            title: 'Improve Overall AI Readiness',
            description: 'Your website needs significant improvements for AI optimization. Focus on structured data, content accessibility, and performance.',
            impact: 'High - Comprehensive improvements needed'
        });
    }

    return recommendations.slice(0, 6); // Limit to top 6 recommendations
}

// Routes

// Homepage route
app.get('/', (req, res) => {
    res.render('index', {
        pageTitle: 'AIO Ready - Website AI Optimization Audit',
        appName: 'AIO Ready',
        appDescription: 'Audit your website\'s readiness for AI optimization',
        version: '1.0.0',
        apiBaseUrl: NODE_ENV === 'production' ? req.protocol + '://' + req.get('host') : 'http://localhost:3000',
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

// Main audit endpoint with better error handling
app.post('/api/audit', rateLimit, async (req, res) => {
    try {
        const { url } = req.body;
        
        // Validate URL
        if (!url || !validator.isURL(url)) {
            return res.status(400).json({
                error: 'Invalid URL provided',
                message: 'Please provide a valid URL starting with http:// or https://'
            });
        }

        let pageData;
        let fetchError = null;
        
        try {
            // Try to fetch page content
            pageData = await fetchPageContent(url);
        } catch (error) {
            fetchError = error;
            console.error('Fetch error:', error.message);
            
            // For access denied or other fetch errors, return a partial audit
            return res.status(200).json({
                success: true,
                audit: generateLimitedAudit(url, fetchError),
                recommendations: generateFetchErrorRecommendations(fetchError),
                warning: 'Limited analysis due to access restrictions',
                error: error.message
            });
        }
        
        // Run all analyses if fetch was successful
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

        // Calculate overall score (weighted average)
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
            domain: urlParse(url).hostname,
            timestamp: new Date().toISOString(),
            overallScore,
            sections: {
                contentStructure: {
                    title: 'Content Structure & Markup',
                    score: contentStructure.score,
                    checks: contentStructure.checks
                },
                aiAccessibility: {
                    title: 'AI Agent Accessibility',
                    score: aiAccessibility.score,
                    checks: aiAccessibility.checks
                },
                dataQuality: {
                    title: 'Data Quality & Format',
                    score: dataQuality.score,
                    checks: dataQuality.checks
                },
                performance: {
                    title: 'Performance & Speed',
                    score: performance.score,
                    checks: performance.checks
                },
                structuredData: {
                    title: 'Structured Data & Schema',
                    score: structuredData.score,
                    checks: structuredData.checks
                },
                socialMedia: {
                    title: 'Social Media & Sharing',
                    score: socialMedia.score,
                    checks: socialMedia.checks
                },
                accessibility: {
                    title: 'Accessibility & Usability',
                    score: accessibility.score,
                    checks: accessibility.checks
                },
                security: {
                    title: 'Security & Privacy',
                    score: security.score,
                    checks: security.checks
                }
            }
        };

        // Generate recommendations
        const recommendations = generateRecommendations(auditResults);

        res.json({
            success: true,
            audit: auditResults,
            recommendations
        });

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
    const domain = urlParse(url).hostname;
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
                checks: [
                    {
                        name: 'Content Access',
                        status: 'fail',
                        description: 'Unable to access website content for analysis'
                    }
                ]
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
                checks: [
                    {
                        name: 'Content Analysis',
                        status: 'fail',
                        description: 'Cannot analyze content quality - access blocked'
                    }
                ]
            },
            performance: {
                title: 'Performance & Speed',
                score: isHttps ? 50 : 25,
                checks: [
                    {
                        name: 'HTTPS Security',
                        status: isHttps ? 'pass' : 'fail',
                        description: isHttps 
                            ? 'Website uses secure HTTPS protocol' 
                            : 'Website does not use HTTPS - security risk'
                    },
                    {
                        name: 'Accessibility',
                        status: 'fail',
                        description: 'Unable to test performance - access blocked'
                    }
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

// Audit results page (for sharing results)
app.get('/audit/:id', (req, res) => {
    // In a real app, you'd fetch the audit from database using the ID
    res.render('audit-result', {
        pageTitle: 'Audit Results - AIO Ready',
        appName: 'AIO Ready',
        auditId: req.params.id,
        version: '1.0.0'
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
    console.log(`🚀 AIO Audit Server running on port ${PORT}`);
    console.log(`📊 Environment: ${NODE_ENV}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    console.log(`📖 API docs: http://localhost:${PORT}/api/docs`);
});

module.exports = app;
