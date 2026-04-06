'use strict';

const {
    analyzeContentStructure,
    analyzeDataQuality,
    analyzePerformance,
    analyzeStructuredData,
    analyzeSocialMedia,
    analyzeAccessibility,
    analyzeSecurity,
    generateRecommendations,
} = require('../../lib/analyzers');

// ─── helpers ──────────────────────────────────────────────────────────────────

function checkByName(checks, name) {
    return checks.find(c => c.name === name);
}

// ─── analyzeContentStructure ──────────────────────────────────────────────────

describe('analyzeContentStructure', () => {
    const url = 'https://example.com';

    test('passes semantic HTML when 3+ semantic elements present', () => {
        const html = '<html><body><header></header><main></main><footer></footer></body></html>';
        const { checks, score } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Semantic HTML Usage').status).toBe('pass');
        expect(score).toBeGreaterThan(0);
    });

    test('fails semantic HTML when fewer than 3 semantic elements', () => {
        const html = '<html><body><div></div></body></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Semantic HTML Usage').status).toBe('fail');
    });

    test('passes heading hierarchy with single H1 and multiple levels', () => {
        const html = '<html><body><h1>Title</h1><h2>Sub</h2><h3>Sub-sub</h3></body></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Heading Hierarchy').status).toBe('pass');
    });

    test('warns heading hierarchy with H1 but no sub-headings', () => {
        const html = '<html><body><h1>Only title</h1></body></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Heading Hierarchy').status).toBe('warning');
    });

    test('fails heading hierarchy with no H1', () => {
        const html = '<html><body><h2>No H1</h2></body></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Heading Hierarchy').status).toBe('fail');
    });

    test('passes meta description in optimal range (120–160 chars)', () => {
        const desc = 'A'.repeat(130);
        const html = `<html><head><meta name="description" content="${desc}"></head></html>`;
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Meta Description').status).toBe('pass');
    });

    test('warns meta description outside optimal range', () => {
        const html = '<html><head><meta name="description" content="Too short"></head></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Meta Description').status).toBe('warning');
    });

    test('fails meta description when missing', () => {
        const html = '<html><head></head></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Meta Description').status).toBe('fail');
    });

    test('passes structured data with JSON-LD present', () => {
        const html = '<html><head><script type="application/ld+json">{}</script></head></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Structured Data').status).toBe('pass');
    });

    test('warns structured data with only Open Graph tags', () => {
        const html = '<html><head><meta property="og:title" content="T"></head></html>';
        const { checks } = analyzeContentStructure(html, url);
        expect(checkByName(checks, 'Structured Data').status).toBe('warning');
    });

    test('score does not exceed 100', () => {
        const desc = 'A'.repeat(130);
        const html = `
            <html><head>
                <meta name="description" content="${desc}">
                <script type="application/ld+json">{}</script>
            </head><body>
                <header></header><main><h1>Hi</h1><h2>Sub</h2></main><footer></footer>
            </body></html>`;
        const { score } = analyzeContentStructure(html, url);
        expect(score).toBeLessThanOrEqual(100);
    });
});

// ─── analyzeDataQuality ───────────────────────────────────────────────────────

describe('analyzeDataQuality', () => {
    const url = 'https://example.com';

    test('passes content format with 3+ paragraphs and 1000+ chars', () => {
        const para = '<p>' + 'word '.repeat(60) + '</p>';
        const html = `<html><body>${para.repeat(5)}</body></html>`;
        const { checks } = analyzeDataQuality(html, url);
        expect(checkByName(checks, 'Content Format Quality').status).toBe('pass');
    });

    test('fails content format with minimal content', () => {
        const html = '<html><body><p>Hi</p></body></html>';
        const { checks } = analyzeDataQuality(html, url);
        expect(checkByName(checks, 'Content Format Quality').status).toBe('fail');
    });

    test('passes image optimization when all images have descriptive alt text', () => {
        const html = '<html><body><img src="a.png" alt="A nice photo"><img src="b.png" alt="Another photo"></body></html>';
        const { checks } = analyzeDataQuality(html, url);
        expect(checkByName(checks, 'Image Optimization').status).toBe('pass');
    });

    test('fails image optimization when most images lack alt text', () => {
        const html = '<html><body><img src="a.png"><img src="b.png"><img src="c.png"></body></html>';
        const { checks } = analyzeDataQuality(html, url);
        expect(checkByName(checks, 'Image Optimization').status).toBe('fail');
    });

    test('passes image optimization with no images', () => {
        const html = '<html><body><p>No images here</p></body></html>';
        const { checks } = analyzeDataQuality(html, url);
        expect(checkByName(checks, 'Image Optimization').status).toBe('pass');
    });

    test('passes contact information when email present in HTML', () => {
        const html = '<html><body><a href="mailto:hello@example.com">email us</a></body></html>';
        const { checks } = analyzeDataQuality(html, url);
        expect(checkByName(checks, 'Contact Information').status).toBe('pass');
    });

    test('passes content consistency when title and H1 match', () => {
        const html = '<html><head><title>Acme Corp</title></head><body><h1>Acme Corp</h1></body></html>';
        const { checks } = analyzeDataQuality(html, url);
        expect(checkByName(checks, 'Content Consistency').status).toBe('pass');
    });
});

// ─── analyzePerformance ───────────────────────────────────────────────────────

describe('analyzePerformance', () => {
    test('passes HTTPS security for https:// URL', () => {
        const { checks } = analyzePerformance('https://example.com', {}, '<html></html>');
        expect(checkByName(checks, 'HTTPS Security').status).toBe('pass');
    });

    test('fails HTTPS security for http:// URL', () => {
        const { checks } = analyzePerformance('http://example.com', {}, '<html></html>');
        expect(checkByName(checks, 'HTTPS Security').status).toBe('fail');
    });

    test('passes mobile responsiveness with viewport tag and @media in HTML', () => {
        const html = '<html><head><meta name="viewport" content="width=device-width"></head><style>@media (max-width:768px){}</style></html>';
        const { checks } = analyzePerformance('https://example.com', {}, html);
        expect(checkByName(checks, 'Mobile Responsiveness').status).toBe('pass');
    });

    test('fails mobile responsiveness with no viewport tag', () => {
        const { checks } = analyzePerformance('https://example.com', {}, '<html></html>');
        expect(checkByName(checks, 'Mobile Responsiveness').status).toBe('fail');
    });

    test('passes content compression with gzip header', () => {
        const { checks } = analyzePerformance('https://example.com', { 'content-encoding': 'gzip' }, '<html></html>');
        expect(checkByName(checks, 'Content Compression').status).toBe('pass');
    });

    test('passes content compression with br header', () => {
        const { checks } = analyzePerformance('https://example.com', { 'content-encoding': 'br' }, '<html></html>');
        expect(checkByName(checks, 'Content Compression').status).toBe('pass');
    });

    test('warns content compression when no encoding header', () => {
        const { checks } = analyzePerformance('https://example.com', {}, '<html></html>');
        expect(checkByName(checks, 'Content Compression').status).toBe('warning');
    });

    test('passes caching strategy with cache-control header', () => {
        const { checks } = analyzePerformance('https://example.com', { 'cache-control': 'max-age=3600' }, '<html></html>');
        expect(checkByName(checks, 'Caching Strategy').status).toBe('pass');
    });

    test('passes caching strategy with etag header', () => {
        const { checks } = analyzePerformance('https://example.com', { 'etag': '"abc123"' }, '<html></html>');
        expect(checkByName(checks, 'Caching Strategy').status).toBe('pass');
    });
});

// ─── analyzeStructuredData ────────────────────────────────────────────────────

describe('analyzeStructuredData', () => {
    const url = 'https://example.com';

    test('passes rich structured data with 3+ JSON-LD items', () => {
        const ld = JSON.stringify([
            { '@type': 'Organization' },
            { '@type': 'WebSite' },
            { '@type': 'Article' }
        ]);
        const html = `<html><head><script type="application/ld+json">${ld}</script></head></html>`;
        const { checks } = analyzeStructuredData(html, url);
        expect(checkByName(checks, 'Rich Structured Data').status).toBe('pass');
    });

    test('warns basic structured data with 1 JSON-LD item', () => {
        const ld = JSON.stringify({ '@type': 'WebSite' });
        const html = `<html><head><script type="application/ld+json">${ld}</script></head></html>`;
        const { checks } = analyzeStructuredData(html, url);
        expect(checkByName(checks, 'Basic Structured Data').status).toBe('warning');
    });

    test('fails when no structured data present', () => {
        const html = '<html><head></head></html>';
        const { checks } = analyzeStructuredData(html, url);
        expect(checkByName(checks, 'No Structured Data').status).toBe('fail');
    });

    test('passes Open Graph with all 4 essential tags', () => {
        const html = `<html><head>
            <meta property="og:title" content="T">
            <meta property="og:description" content="D">
            <meta property="og:image" content="I">
            <meta property="og:url" content="U">
        </head></html>`;
        const { checks } = analyzeStructuredData(html, url);
        expect(checkByName(checks, 'Open Graph Optimization').status).toBe('pass');
    });

    test('fails Open Graph with no OG tags', () => {
        const html = '<html><head></head></html>';
        const { checks } = analyzeStructuredData(html, url);
        expect(checkByName(checks, 'Open Graph Optimization').status).toBe('fail');
    });

    test('passes Twitter Cards when twitter: meta tags present', () => {
        const html = '<html><head><meta name="twitter:card" content="summary"></head></html>';
        const { checks } = analyzeStructuredData(html, url);
        expect(checkByName(checks, 'Twitter Card Optimization').status).toBe('pass');
    });

    test('passes Schema.org implementation with 2+ important types', () => {
        const ld = JSON.stringify([{ '@type': 'Organization' }, { '@type': 'WebSite' }]);
        const html = `<html><head><script type="application/ld+json">${ld}</script></head></html>`;
        const { checks } = analyzeStructuredData(html, url);
        expect(checkByName(checks, 'Schema.org Implementation').status).toBe('pass');
    });

    test('ignores invalid JSON-LD without throwing', () => {
        const html = '<html><head><script type="application/ld+json">NOT JSON</script></head></html>';
        expect(() => analyzeStructuredData(html, url)).not.toThrow();
    });
});

// ─── analyzeSecurity ──────────────────────────────────────────────────────────

describe('analyzeSecurity', () => {
    const url = 'https://example.com';
    const emptyHeaders = {};

    test('passes HTTPS implementation for https:// URL', () => {
        const { checks } = analyzeSecurity('<html></html>', url, emptyHeaders);
        expect(checkByName(checks, 'HTTPS Implementation').status).toBe('pass');
    });

    test('fails HTTPS implementation for http:// URL', () => {
        const { checks } = analyzeSecurity('<html></html>', 'http://example.com', emptyHeaders);
        expect(checkByName(checks, 'HTTPS Implementation').status).toBe('fail');
    });

    test('passes security headers when 4+ are present', () => {
        const headers = {
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'strict-transport-security': 'max-age=31536000',
            'content-security-policy': "default-src 'self'",
            'x-xss-protection': '1; mode=block'
        };
        const { checks } = analyzeSecurity('<html></html>', url, headers);
        expect(checkByName(checks, 'Security Headers').status).toBe('pass');
    });

    test('fails security headers when fewer than 2 present', () => {
        const { checks } = analyzeSecurity('<html></html>', url, emptyHeaders);
        expect(checkByName(checks, 'Security Headers').status).toBe('fail');
    });

    test('passes external resource security with no http:// resources', () => {
        const html = '<html><head><script src="https://cdn.example.com/app.js"></script></head></html>';
        const { checks } = analyzeSecurity(html, url, emptyHeaders);
        expect(checkByName(checks, 'External Resource Security').status).toBe('pass');
    });

    test('warns external resource security with http:// script', () => {
        const html = '<html><head><script src="http://cdn.example.com/app.js"></script></head></html>';
        const { checks } = analyzeSecurity(html, url, emptyHeaders);
        expect(checkByName(checks, 'External Resource Security').status).toBe('warning');
    });

    test('passes form security when no forms present', () => {
        const { checks } = analyzeSecurity('<html><body></body></html>', url, emptyHeaders);
        expect(checkByName(checks, 'Form Security').status).toBe('pass');
    });

    test('passes form security when forms have hidden token inputs', () => {
        const html = '<html><body><form><input type="hidden" name="csrf_token" value="x"></form></body></html>';
        const { checks } = analyzeSecurity(html, url, emptyHeaders);
        expect(checkByName(checks, 'Form Security').status).toBe('pass');
    });
});

// ─── analyzeSocialMedia ───────────────────────────────────────────────────────

describe('analyzeSocialMedia', () => {
    const url = 'https://example.com';

    test('passes social media presence with 3+ platform links', () => {
        const html = `<html><body>
            <a href="https://twitter.com/acme">Twitter</a>
            <a href="https://linkedin.com/company/acme">LinkedIn</a>
            <a href="https://github.com/acme">GitHub</a>
        </body></html>`;
        const { checks } = analyzeSocialMedia(html, url);
        expect(checkByName(checks, 'Social Media Presence').status).toBe('pass');
    });

    test('fails social media presence with no platform links', () => {
        const { checks } = analyzeSocialMedia('<html><body></body></html>', url);
        expect(checkByName(checks, 'Social Media Presence').status).toBe('fail');
    });

    test('passes RSS feeds when rss link tag present', () => {
        const html = '<html><head><link type="application/rss+xml" href="/feed.xml"></head></html>';
        const { checks } = analyzeSocialMedia(html, url);
        expect(checkByName(checks, 'RSS/Atom Feeds').status).toBe('pass');
    });

    test('passes email sharing when mailto link present', () => {
        const html = '<html><body><a href="mailto:hi@example.com">Email</a></body></html>';
        const { checks } = analyzeSocialMedia(html, url);
        expect(checkByName(checks, 'Email Sharing').status).toBe('pass');
    });
});

// ─── analyzeAccessibility ─────────────────────────────────────────────────────

describe('analyzeAccessibility', () => {
    const url = 'https://example.com';

    test('passes ARIA implementation with 5+ ARIA attributes', () => {
        const html = `<html><body>
            <button aria-label="Close">X</button>
            <nav role="navigation" aria-label="Main">
                <a href="#" aria-label="Home">Home</a>
                <div role="menuitem" aria-labelledby="label1">Item</div>
                <span role="button" aria-label="Go">Go</span>
            </nav>
        </body></html>`;
        const { checks } = analyzeAccessibility(html, url);
        expect(checkByName(checks, 'ARIA Implementation').status).toBe('pass');
    });

    test('fails ARIA implementation with no ARIA attributes', () => {
        const { checks } = analyzeAccessibility('<html><body></body></html>', url);
        expect(checkByName(checks, 'ARIA Implementation').status).toBe('fail');
    });

    test('passes form accessibility when inputs have matching labels', () => {
        const html = `<html><body>
            <form>
                <label for="name">Name</label>
                <input id="name" type="text">
            </form>
        </body></html>`;
        const { checks } = analyzeAccessibility(html, url);
        expect(checkByName(checks, 'Form Accessibility').status).toBe('pass');
    });

    test('passes form accessibility when no forms present', () => {
        const { checks } = analyzeAccessibility('<html><body></body></html>', url);
        expect(checkByName(checks, 'Form Accessibility').status).toBe('pass');
    });

    test('passes navigation accessibility with nav and anchor links', () => {
        const html = `<html><body>
            <a href="#main">Skip to main</a>
            <nav><a href="/">Home</a></nav>
        </body></html>`;
        const { checks } = analyzeAccessibility(html, url);
        expect(checkByName(checks, 'Navigation Accessibility').status).toBe('pass');
    });
});

// ─── generateRecommendations ──────────────────────────────────────────────────

describe('generateRecommendations', () => {
    function makeAuditResults(failedCheckNames, overallScore = 80) {
        return {
            overallScore,
            sections: {
                test: {
                    checks: failedCheckNames.map(name => ({ name, status: 'fail' }))
                }
            }
        };
    }

    test('returns recommendation for No Structured Data', () => {
        const results = makeAuditResults(['No Structured Data']);
        const recs = generateRecommendations(results);
        expect(recs.some(r => r.title.includes('Schema.org'))).toBe(true);
    });

    test('returns recommendation for HTTPS Security failure', () => {
        const results = makeAuditResults(['HTTPS Security']);
        const recs = generateRecommendations(results);
        expect(recs.some(r => r.title.includes('HTTPS'))).toBe(true);
    });

    test('returns recommendation for Security Headers failure', () => {
        const results = makeAuditResults(['Security Headers']);
        const recs = generateRecommendations(results);
        expect(recs.some(r => r.title.includes('Security Headers'))).toBe(true);
    });

    test('returns recommendation for llms.txt failure', () => {
        const results = makeAuditResults(['llms.txt']);
        const recs = generateRecommendations(results);
        expect(recs.some(r => r.title.includes('llms.txt'))).toBe(true);
    });

    test('returns recommendation for AI Bot Directives failure', () => {
        const results = makeAuditResults(['AI Bot Directives']);
        const recs = generateRecommendations(results);
        expect(recs.some(r => r.title.includes('AI Bot'))).toBe(true);
    });

    test('prepends overall readiness recommendation when score < 70', () => {
        const results = makeAuditResults([], 50);
        const recs = generateRecommendations(results);
        expect(recs[0].title).toMatch(/AI Readiness/i);
    });

    test('does not prepend overall recommendation when score >= 70', () => {
        const results = makeAuditResults([], 75);
        const recs = generateRecommendations(results);
        expect(recs.every(r => !r.title.match(/Overall AI Readiness/))).toBe(true);
    });

    test('returns at most 6 recommendations', () => {
        const failedChecks = [
            'No Structured Data', 'HTTPS Security', 'Security Headers',
            'llms.txt', 'AI Bot Directives', 'ARIA Implementation', 'Open Graph Optimization'
        ];
        const results = makeAuditResults(failedChecks, 30);
        const recs = generateRecommendations(results);
        expect(recs.length).toBeLessThanOrEqual(6);
    });

    test('all recommendations have priority, title, and description', () => {
        const results = makeAuditResults(['No Structured Data', 'HTTPS Security']);
        const recs = generateRecommendations(results);
        recs.forEach(rec => {
            expect(rec).toHaveProperty('priority');
            expect(rec).toHaveProperty('title');
            expect(rec).toHaveProperty('description');
        });
    });
});
