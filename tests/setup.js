// Global test setup
process.env.NODE_ENV = 'test'
process.env.PORT = '3001'

// Increase timeout for async operations
jest.setTimeout(30000)

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}

// Mock external services that might be slow or unreliable
jest.mock('axios')

// Global test utilities
global.testUtils = {
  // Helper to create mock HTML content
  createMockHTML: (options = {}) => {
    const {
      title = 'Test Page',
      hasH1 = true,
      hasMetaDescription = true,
      hasStructuredData = false,
      hasImages = true,
      hasSemanticElements = true,
      isHttps = true
    } = options

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        ${hasMetaDescription ? '<meta name="description" content="This is a test page description for testing purposes and it is exactly the right length.">' : ''}
        ${hasStructuredData
? `
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Test Website",
            "url": "${isHttps ? 'https' : 'http'}://example.com"
          }
          </script>
        `
: ''}
      </head>
      <body>
        ${hasSemanticElements ? '<header><nav></nav></header>' : ''}
        <main>
          ${hasH1 ? '<h1>Main Heading</h1>' : ''}
          <h2>Subheading</h2>
          <p>This is a paragraph with some content.</p>
          <p>Another paragraph to make the content substantial.</p>
          ${hasImages ? '<img src="test.jpg" alt="Test image description">' : ''}
          <ul>
            <li>List item 1</li>
            <li>List item 2</li>
          </ul>
        </main>
        ${hasSemanticElements ? '<footer></footer>' : ''}
      </body>
      </html>
    `
  },

  // Helper to create mock HTTP headers
  createMockHeaders: (options = {}) => {
    const {
      contentType = 'text/html',
      contentEncoding = 'gzip',
      cacheControl = 'max-age=3600',
      hasEtag = true
    } = options

    return {
      'content-type': contentType,
      'content-encoding': contentEncoding,
      'cache-control': cacheControl,
      ...(hasEtag && { etag: '"abc123"' })
    }
  },

  // Helper to create mock axios response
  createMockAxiosResponse: (data, status = 200, headers = {}) => ({
    data,
    status,
    headers: { ...testUtils.createMockHeaders(), ...headers },
    request: {
      res: {
        responseUrl: 'https://example.com'
      }
    }
  }),

  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
}

// Mock fetch for frontend tests
global.fetch = jest.fn()

// Mock DOM methods for frontend tests
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  querySelectorAll: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    contains: jest.fn()
  }
}

global.window = {
  APP_CONFIG: {
    apiBaseUrl: 'http://localhost:3001',
    appName: 'AIO Ready Test',
    version: '1.0.0',
    isDevelopment: true
  },
  addEventListener: jest.fn(),
  URL: global.URL,
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout
}
