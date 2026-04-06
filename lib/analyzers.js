const cheerio = require('cheerio');

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

// Data Quality Analysis
function analyzeDataQuality(html, url) {
    const $ = cheerio.load(html);
    const checks = [];
    let score = 0;

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
function analyzePerformance(url, headers, html) {
    const checks = [];
    let score = 0;

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
    const schemaTypes = new Set();

    const jsonLdScripts = $('script[type="application/ld+json"]');
    jsonLdScripts.each((i, el) => {
        try {
            const jsonData = JSON.parse($(el).html());
            if (Array.isArray(jsonData)) {
                jsonData.forEach(item => {
                    if (item['@type']) { schemaTypes.add(item['@type']); structuredDataCount++; }
                });
            } else if (jsonData['@type']) {
                schemaTypes.add(jsonData['@type']);
                structuredDataCount++;
            }
        } catch (e) { /* Invalid JSON-LD */ }
    });

    const microdataItems = $('[itemscope]');
    microdataItems.each((i, el) => {
        const itemType = $(el).attr('itemtype');
        if (itemType) {
            schemaTypes.add(itemType.split('/').pop());
            structuredDataCount++;
        }
    });

    const openGraphTags = $('meta[property^="og:"]');
    const hasOpenGraph = openGraphTags.length > 0;
    const essentialOGTags = ['og:title', 'og:description', 'og:image', 'og:url'];
    const foundOGTags = essentialOGTags.filter(tag =>
        openGraphTags.filter((i, el) => $(el).attr('property') === tag).length > 0
    );

    const hasTwitterCards = $('meta[name^="twitter:"]').length > 0;

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
            description: 'Basic Open Graph tags found but missing essential tags'
        });
        score += 10;
    } else {
        checks.push({
            name: 'Open Graph Optimization',
            status: 'fail',
            description: 'No Open Graph tags found - impacts social media sharing'
        });
    }

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
            if (href.includes(domain)) { socialLinks.push(platform); break; }
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

    const sharingButtons = $('a[href*="share"], a[href*="tweet"], .share, .social-share, [class*="share"]');
    if (sharingButtons.length > 0) {
        checks.push({ name: 'Social Sharing', status: 'pass', description: 'Social sharing functionality detected' });
        score += 25;
    } else {
        checks.push({ name: 'Social Sharing', status: 'warning', description: 'No social sharing buttons found - consider adding share functionality' });
        score += 10;
    }

    const rssLinks = $('link[type="application/rss+xml"], link[type="application/atom+xml"]');
    if (rssLinks.length > 0) {
        checks.push({ name: 'RSS/Atom Feeds', status: 'pass', description: 'RSS/Atom feeds available for content syndication' });
        score += 25;
    } else {
        checks.push({ name: 'RSS/Atom Feeds', status: 'warning', description: 'No RSS/Atom feeds found - consider adding for content distribution' });
        score += 10;
    }

    const emailLinks = $('a[href^="mailto:"]');
    if (emailLinks.length > 0) {
        checks.push({ name: 'Email Sharing', status: 'pass', description: 'Email sharing functionality available' });
        score += 25;
    } else {
        checks.push({ name: 'Email Sharing', status: 'warning', description: 'No email sharing links found' });
        score += 10;
    }

    return { checks, score: Math.min(score, 100) };
}

// Accessibility Analysis
function analyzeAccessibility(html, url) {
    const $ = cheerio.load(html);
    const checks = [];
    let score = 0;

    const ariaElements = $('[aria-label], [aria-labelledby], [role]');
    if (ariaElements.length >= 5) {
        checks.push({ name: 'ARIA Implementation', status: 'pass', description: `Good ARIA implementation with ${ariaElements.length} ARIA attributes` });
        score += 25;
    } else if (ariaElements.length >= 1) {
        checks.push({ name: 'ARIA Implementation', status: 'warning', description: `Basic ARIA implementation with ${ariaElements.length} attributes` });
        score += 15;
    } else {
        checks.push({ name: 'ARIA Implementation', status: 'fail', description: 'No ARIA attributes found - important for accessibility' });
    }

    const forms = $('form');
    const formsWithLabels = forms.filter((i, form) => {
        const inputs = $(form).find('input, select, textarea');
        return inputs.length === 0 || inputs.filter((j, input) => {
            const id = $(input).attr('id');
            return id && $(`label[for="${id}"]`).length > 0;
        }).length === inputs.length;
    });

    if (forms.length === 0) {
        checks.push({ name: 'Form Accessibility', status: 'pass', description: 'No forms found to test' });
        score += 25;
    } else if (formsWithLabels.length === forms.length) {
        checks.push({ name: 'Form Accessibility', status: 'pass', description: 'All forms have proper label associations' });
        score += 25;
    } else {
        checks.push({ name: 'Form Accessibility', status: 'warning', description: `${formsWithLabels.length}/${forms.length} forms have proper labels` });
        score += 15;
    }

    const semanticElements = $('header, nav, main, article, section, aside, footer, h1, h2, h3, h4, h5, h6');
    if (semanticElements.length >= 8) {
        checks.push({ name: 'Semantic Markup', status: 'pass', description: `Good semantic structure with ${semanticElements.length} semantic elements` });
        score += 25;
    } else if (semanticElements.length >= 4) {
        checks.push({ name: 'Semantic Markup', status: 'warning', description: `Basic semantic structure with ${semanticElements.length} elements` });
        score += 15;
    } else {
        checks.push({ name: 'Semantic Markup', status: 'fail', description: 'Limited semantic markup - important for screen readers' });
    }

    const skipLinks = $('a[href^="#"], a[href*="skip"], a[href*="nav"]');
    const hasMainNavigation = $('nav').length > 0;

    if (hasMainNavigation && skipLinks.length > 0) {
        checks.push({ name: 'Navigation Accessibility', status: 'pass', description: 'Good navigation structure with skip links' });
        score += 25;
    } else if (hasMainNavigation) {
        checks.push({ name: 'Navigation Accessibility', status: 'warning', description: 'Has navigation but could benefit from skip links' });
        score += 15;
    } else {
        checks.push({ name: 'Navigation Accessibility', status: 'fail', description: 'No clear navigation structure found' });
    }

    return { checks, score: Math.min(score, 100) };
}

// Security Analysis
function analyzeSecurity(html, url, headers) {
    const checks = [];
    let score = 0;

    if (url.startsWith('https://')) {
        checks.push({ name: 'HTTPS Implementation', status: 'pass', description: 'Website uses secure HTTPS protocol' });
        score += 25;
    } else {
        checks.push({ name: 'HTTPS Implementation', status: 'fail', description: 'Website does not use HTTPS - major security risk' });
    }

    const securityHeaderNames = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security',
        'content-security-policy'
    ];
    const foundHeaders = securityHeaderNames.filter(h => !!headers[h]).length;

    if (foundHeaders >= 4) {
        checks.push({ name: 'Security Headers', status: 'pass', description: `Strong security headers: ${foundHeaders}/5 implemented` });
        score += 25;
    } else if (foundHeaders >= 2) {
        checks.push({ name: 'Security Headers', status: 'warning', description: `Basic security headers: ${foundHeaders}/5 implemented` });
        score += 15;
    } else {
        checks.push({ name: 'Security Headers', status: 'fail', description: 'Missing important security headers' });
    }

    const $ = cheerio.load(html);
    const insecureCount = $('script[src^="http://"]').length + $('link[href^="http://"]').length;

    if (insecureCount === 0) {
        checks.push({ name: 'External Resource Security', status: 'pass', description: 'No insecure external resources loaded' });
        score += 25;
    } else {
        checks.push({ name: 'External Resource Security', status: 'warning', description: `${insecureCount} external resources loaded over HTTP` });
        score += 10;
    }

    const forms = $('form');
    const formsWithCSRF = forms.filter((i, form) =>
        $(form).find('input[name*="csrf"], input[name*="token"], input[type="hidden"]').length > 0
    );

    if (forms.length === 0) {
        checks.push({ name: 'Form Security', status: 'pass', description: 'No forms found to test' });
        score += 25;
    } else if (formsWithCSRF.length === forms.length) {
        checks.push({ name: 'Form Security', status: 'pass', description: 'All forms appear to have CSRF protection' });
        score += 25;
    } else {
        checks.push({ name: 'Form Security', status: 'warning', description: `${formsWithCSRF.length}/${forms.length} forms have security tokens` });
        score += 15;
    }

    return { checks, score: Math.min(score, 100) };
}

// Generate recommendations based on audit results
function generateRecommendations(auditResults) {
    const recommendations = [];

    Object.values(auditResults.sections).forEach(section => {
        section.checks.forEach(check => {
            if (check.status === 'fail') {
                switch (check.name) {
                    case 'Structured Data':
                        recommendations.push({ priority: 'high', title: 'Implement Schema.org Markup', description: 'Add JSON-LD structured data to help AI agents understand your content better. Start with Organization, WebSite, and Article schemas.', impact: 'High - Significantly improves AI content understanding' });
                        break;
                    case 'Image Optimization':
                        recommendations.push({ priority: 'medium', title: 'Add Descriptive Alt Text to Images', description: 'Provide meaningful alt text for all images. This helps AI agents understand visual content and improves accessibility.', impact: 'Medium - Enhances content comprehension for AI' });
                        break;
                    case 'HTTPS Security':
                        recommendations.push({ priority: 'high', title: 'Enable HTTPS Security', description: 'Migrate to HTTPS to ensure secure connections. AI agents prefer secure endpoints for data exchange.', impact: 'High - Essential for AI agent trust and security' });
                        break;
                    case 'API Documentation':
                        recommendations.push({ priority: 'medium', title: 'Create API Documentation', description: 'If you have APIs, document them clearly with OpenAPI/Swagger specs. This enables programmatic AI interactions.', impact: 'Medium - Enables advanced AI integrations' });
                        break;
                    case 'No Structured Data':
                        recommendations.push({ priority: 'high', title: 'Implement Schema.org Markup', description: 'Add JSON-LD structured data to help AI agents understand your content better. Start with Organization, WebSite, and Article schemas.', impact: 'High - Significantly improves AI content understanding' });
                        break;
                    case 'Open Graph Optimization':
                        recommendations.push({ priority: 'medium', title: 'Optimize Open Graph Tags', description: 'Add complete Open Graph meta tags (og:title, og:description, og:image, og:url) for better social media sharing.', impact: 'Medium - Improves social media presence' });
                        break;
                    case 'ARIA Implementation':
                        recommendations.push({ priority: 'medium', title: 'Implement ARIA Attributes', description: 'Add ARIA labels, roles, and descriptions to improve accessibility for screen readers and AI agents.', impact: 'Medium - Enhances accessibility and AI understanding' });
                        break;
                    case 'Security Headers':
                        recommendations.push({ priority: 'high', title: 'Implement Security Headers', description: 'Add security headers like X-Content-Type-Options, X-Frame-Options, and Content-Security-Policy.', impact: 'High - Essential for security and AI agent trust' });
                        break;
                    case 'llms.txt':
                        recommendations.push({ priority: 'high', title: 'Add llms.txt', description: "Create a /llms.txt file to guide LLMs on how to use your site's content. Include your site name, description, key pages, and any usage guidelines. See llmstxt.org for the specification.", impact: 'High - Directly improves LLM content discovery and citation quality' });
                        break;
                    case 'AI Bot Directives':
                        recommendations.push({ priority: 'medium', title: 'Add AI Bot Directives to robots.txt', description: 'Explicitly allow major AI crawlers in your robots.txt: GPTBot, ClaudeBot, PerplexityBot, GoogleExtended. This signals that your content is open to AI indexing.', impact: 'Medium - Ensures AI search engines can index your content' });
                        break;
                }
            }
        });
    });

    if (auditResults.overallScore < 70) {
        recommendations.unshift({ priority: 'high', title: 'Improve Overall AI Readiness', description: 'Your website needs significant improvements for AI optimization. Focus on structured data, content accessibility, and performance.', impact: 'High - Comprehensive improvements needed' });
    }

    return recommendations.slice(0, 6);
}

module.exports = {
    analyzeContentStructure,
    analyzeDataQuality,
    analyzePerformance,
    analyzeStructuredData,
    analyzeSocialMedia,
    analyzeAccessibility,
    analyzeSecurity,
    generateRecommendations
};
