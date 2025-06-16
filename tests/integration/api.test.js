const request = require('supertest')
const axios = require('axios')

// Mock axios for integration tests
jest.mock('axios')
const mockedAxios = axios

describe('API Integration Tests', () => {
  let app

  beforeAll(() => {
    // Start the server for integration testing
    app = require('../../server')
  })

  afterAll(() => {
    // Clean up server
    if (app && app.close) {
      app.close()
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Full Audit Workflow', () => {
    test('should complete full audit workflow for HTTPS site', async() => {
      // Mock all external API calls
      const mockHTML = testUtils.createMockHTML({
        hasStructuredData: true,
        hasSemanticElements: true,
        hasMetaDescription: true,
        hasImages: true
      })

      // Mock main page fetch
      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
        // Mock robots.txt fetch
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        // Mock sitemap fetch (head request)
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        audit: {
          url: expect.stringContaining('example.com'),
          domain: 'example.com',
          overallScore: expect.any(Number),
          timestamp: expect.any(String),
          sections: {
            contentStructure: {
              title: 'Content Structure & Markup',
              score: expect.any(Number),
              checks: expect.arrayContaining([
                expect.objectContaining({
                  name: expect.any(String),
                  status: expect.stringMatching(/^(pass|fail|warning)$/),
                  description: expect.any(String)
                })
              ])
            },
            aiAccessibility: {
              title: 'AI Agent Accessibility',
              score: expect.any(Number),
              checks: expect.any(Array)
            },
            dataQuality: {
              title: 'Data Quality & Format',
              score: expect.any(Number),
              checks: expect.any(Array)
            },
            performance: {
              title: 'Performance & Speed',
              score: expect.any(Number),
              checks: expect.any(Array)
            }
          }
        },
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String),
            priority: expect.stringMatching(/^(high|medium|low)$/)
          })
        ])
      })

      // Verify overall score is calculated correctly
      expect(response.body.audit.overallScore).toBeGreaterThanOrEqual(0)
      expect(response.body.audit.overallScore).toBeLessThanOrEqual(100)

      // Verify all sections have valid scores
      Object.values(response.body.audit.sections).forEach(section => {
        expect(section.score).toBeGreaterThanOrEqual(0)
        expect(section.score).toBeLessThanOrEqual(100)
      })
    })

    test('should handle HTTP site with security warnings', async() => {
      const mockHTML = testUtils.createMockHTML()

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'http://example.com' })
        .expect(200)

      expect(response.body.success).toBe(true)

      // Check that HTTPS security check fails for HTTP site
      const performanceSection = response.body.audit.sections.performance
      const httpsCheck = performanceSection.checks.find(check =>
        check.name === 'HTTPS Security'
      )

      expect(httpsCheck.status).toBe('fail')
      expect(httpsCheck.description).toContain('does not use HTTPS')
    })
  })

  describe('Error Scenarios Integration', () => {
    test('should handle 403 forbidden with limited audit', async() => {
      const error = new Error('Request failed with status code 403')
      error.response = { status: 403 }
      mockedAxios.get.mockRejectedValueOnce(error)

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://blocked-site.com' })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        warning: expect.stringContaining('Limited analysis'),
        error: expect.stringContaining('403'),
        audit: {
          limited: true,
          overallScore: 'N/A',
          url: 'https://blocked-site.com',
          domain: 'blocked-site.com'
        },
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Bot Blocking'),
            priority: 'high'
          })
        ])
      })
    })

    test('should handle timeout errors gracefully', async() => {
      const error = new Error('timeout of 10000ms exceeded')
      error.code = 'ETIMEDOUT'
      mockedAxios.get.mockRejectedValueOnce(error)

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://slow-site.com' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.audit.limited).toBe(true)
      expect(response.body.error).toContain('timeout')
    })

    test('should handle domain not found errors', async() => {
      const error = new Error('getaddrinfo ENOTFOUND')
      error.code = 'ENOTFOUND'
      mockedAxios.get.mockRejectedValueOnce(error)

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://nonexistent-domain-12345.com' })
        .expect(200)

      expect(response.body.audit.limited).toBe(true)
      expect(response.body.error).toContain('not found')
    })
  })

  describe('Content Analysis Integration', () => {
    test('should properly analyze structured data', async() => {
      const htmlWithStructuredData = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page with Schema</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Test Company",
            "url": "https://example.com"
          }
          </script>
        </head>
        <body>
          <h1>Main Heading</h1>
          <p>Content here</p>
        </body>
        </html>
      `

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(htmlWithStructuredData))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      const contentSection = response.body.audit.sections.contentStructure
      const structuredDataCheck = contentSection.checks.find(check =>
        check.name === 'Structured Data'
      )

      expect(structuredDataCheck.status).toBe('pass')
      expect(structuredDataCheck.description).toContain('JSON-LD')
    })

    test('should analyze image optimization correctly', async() => {
      const htmlWithImages = `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>Test Page</h1>
          <img src="image1.jpg" alt="Good alt text">
          <img src="image2.jpg" alt="">
          <img src="image3.jpg">
        </body>
        </html>
      `

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(htmlWithImages))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      const dataQualitySection = response.body.audit.sections.dataQuality
      const imageCheck = dataQualitySection.checks.find(check =>
        check.name === 'Image Optimization'
      )

      // Should warn or fail because not all images have good alt text
      expect(['warning', 'fail']).toContain(imageCheck.status)
    })
  })

  describe('Performance Analysis Integration', () => {
    test('should detect compression and caching headers', async() => {
      const mockHTML = testUtils.createMockHTML()
      const headers = testUtils.createMockHeaders({
        contentEncoding: 'gzip',
        cacheControl: 'max-age=3600, public'
      })

      mockedAxios.get
        .mockResolvedValueOnce({
          ...testUtils.createMockAxiosResponse(mockHTML),
          headers
        })
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      const performanceSection = response.body.audit.sections.performance

      const compressionCheck = performanceSection.checks.find(check =>
        check.name === 'Content Compression'
      )
      const cachingCheck = performanceSection.checks.find(check =>
        check.name === 'Caching Strategy'
      )

      expect(compressionCheck.status).toBe('pass')
      expect(compressionCheck.description).toContain('gzip')

      expect(cachingCheck.status).toBe('pass')
      expect(cachingCheck.description).toContain('Caching headers present')
    })
  })

  describe('Robots.txt Analysis Integration', () => {
    test('should handle missing robots.txt gracefully', async() => {
      const mockHTML = testUtils.createMockHTML()

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
        // robots.txt not found
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      const aiAccessibilitySection = response.body.audit.sections.aiAccessibility
      const robotsCheck = aiAccessibilitySection.checks.find(check =>
        check.name === 'Robots.txt Accessibility'
      )

      expect(robotsCheck.status).toBe('warning')
      expect(robotsCheck.description).toContain('No robots.txt found')
    })

    test('should parse restrictive robots.txt correctly', async() => {
      const mockHTML = testUtils.createMockHTML()
      const restrictiveRobots = `
        User-agent: *
        Disallow: /
        Allow: /public/
      `

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(restrictiveRobots))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      const aiAccessibilitySection = response.body.audit.sections.aiAccessibility
      const robotsCheck = aiAccessibilitySection.checks.find(check =>
        check.name === 'Robots.txt Accessibility'
      )

      // Should be warning due to restrictions
      expect(robotsCheck.status).toBe('warning')
      expect(robotsCheck.description).toContain('restrictions')
    })
  })

  describe('Rate Limiting Integration', () => {
    test('should enforce rate limits properly', async() => {
      const requests = []

      // Send multiple requests rapidly
      for (let i = 0; i < 12; i++) {
        requests.push(
          request(app)
            .post('/api/audit')
            .send({ url: 'https://example.com' })
        )
      }

      const responses = await Promise.allSettled(requests)

      // Check that some requests were rate limited
      const successful = responses.filter(r => r.value?.status === 200)
      const rateLimited = responses.filter(r => r.value?.status === 429)

      expect(rateLimited.length).toBeGreaterThan(0)
      expect(successful.length).toBeLessThan(12)
    })
  })

  describe('Recommendation Generation Integration', () => {
    test('should generate relevant recommendations for poor site', async() => {
      const poorHTML = `
        <!DOCTYPE html>
        <html>
        <body>
          <div>No proper structure</div>
          <img src="test.jpg">
        </body>
        </html>
      `

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(poorHTML))
        .mockRejectedValueOnce({ response: { status: 404 } }) // No robots.txt
        .mockRejectedValueOnce({ response: { status: 404 } }) // No sitemap

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'http://poor-site.com' }) // HTTP, not HTTPS
        .expect(200)

      expect(response.body.recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'high',
            title: expect.stringContaining('HTTPS')
          })
        ])
      )

      // Should have recommendations for multiple issues
      expect(response.body.recommendations.length).toBeGreaterThan(1)
    })

    test('should generate fewer recommendations for good site', async() => {
      const goodHTML = testUtils.createMockHTML({
        hasStructuredData: true,
        hasSemanticElements: true,
        hasMetaDescription: true,
        hasImages: true,
        isHttps: true
      })

      const goodHeaders = testUtils.createMockHeaders({
        contentEncoding: 'gzip',
        cacheControl: 'max-age=3600'
      })

      mockedAxios.get
        .mockResolvedValueOnce({
          ...testUtils.createMockAxiosResponse(goodHTML),
          headers: goodHeaders
        })
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://good-site.com' })
        .expect(200)

      // Good site should have fewer recommendations
      expect(response.body.recommendations.length).toBeLessThanOrEqual(3)
      expect(response.body.audit.overallScore).toBeGreaterThan(70)
    })
  })

  describe('Multiple Domain Testing', () => {
    test('should handle different domain patterns correctly', async() => {
      const domains = [
        'https://example.com',
        'https://www.example.com',
        'https://subdomain.example.com',
        'https://example.co.uk'
      ]

      for (const domain of domains) {
        const mockHTML = testUtils.createMockHTML()

        mockedAxios.get
          .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
          .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
          .mockResolvedValueOnce({ status: 200 })

        const response = await request(app)
          .post('/api/audit')
          .send({ url: domain })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.audit.url).toContain(new URL(domain).hostname)
      }
    })
  })

  describe('Edge Cases Integration', () => {
    test('should handle redirects properly', async() => {
      const finalUrl = 'https://example.com/final'
      const mockHTML = testUtils.createMockHTML()

      mockedAxios.get
        .mockResolvedValueOnce({
          ...testUtils.createMockAxiosResponse(mockHTML),
          request: {
            res: {
              responseUrl: finalUrl
            }
          }
        })
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com/redirect' })
        .expect(200)

      expect(response.body.audit.url).toBe(finalUrl)
    })

    test('should handle very large HTML pages', async() => {
      // Create a large HTML document
      const largeContent = 'Large content section. '.repeat(1000)
      const largeHTML = `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>Large Page</h1>
          <p>${largeContent}</p>
        </body>
        </html>
      `

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(largeHTML))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://large-site.com' })
        .expect(200)

      expect(response.body.success).toBe(true)

      // Should handle large content without issues
      const dataQualitySection = response.body.audit.sections.dataQuality
      const contentCheck = dataQualitySection.checks.find(check =>
        check.name === 'Content Format Quality'
      )
      expect(contentCheck.status).toBe('pass')
    })

    test('should handle malformed HTML gracefully', async() => {
      const malformedHTML = `
        <html>
        <head>
          <title>Broken HTML
        <body>
          <h1>Missing closing tags
          <p>Malformed content
          <div><span>Unclosed elements
        </body>
      `

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(malformedHTML))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://broken-site.com' })
        .expect(200)

      expect(response.body.success).toBe(true)
      // Should still provide some analysis even with malformed HTML
      expect(response.body.audit.sections).toBeDefined()
    })
  })

  describe('API Response Validation', () => {
    test('should return consistent response structure', async() => {
      const mockHTML = testUtils.createMockHTML()

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      // Validate response structure
      expect(response.body).toHaveProperty('success')
      expect(response.body).toHaveProperty('audit')
      expect(response.body).toHaveProperty('recommendations')

      // Validate audit structure
      const audit = response.body.audit
      expect(audit).toHaveProperty('url')
      expect(audit).toHaveProperty('domain')
      expect(audit).toHaveProperty('timestamp')
      expect(audit).toHaveProperty('overallScore')
      expect(audit).toHaveProperty('sections')

      // Validate sections structure
      const requiredSections = ['contentStructure', 'aiAccessibility', 'dataQuality', 'performance']
      requiredSections.forEach(sectionName => {
        expect(audit.sections).toHaveProperty(sectionName)
        const section = audit.sections[sectionName]
        expect(section).toHaveProperty('title')
        expect(section).toHaveProperty('score')
        expect(section).toHaveProperty('checks')
        expect(Array.isArray(section.checks)).toBe(true)
      })

      // Validate checks structure
      Object.values(audit.sections).forEach(section => {
        section.checks.forEach(check => {
          expect(check).toHaveProperty('name')
          expect(check).toHaveProperty('status')
          expect(check).toHaveProperty('description')
          expect(['pass', 'fail', 'warning']).toContain(check.status)
        })
      })

      // Validate recommendations structure
      expect(Array.isArray(response.body.recommendations)).toBe(true)
      response.body.recommendations.forEach(recommendation => {
        expect(recommendation).toHaveProperty('title')
        expect(recommendation).toHaveProperty('description')
        expect(recommendation).toHaveProperty('priority')
        expect(['high', 'medium', 'low']).toContain(recommendation.priority)
      })
    })

    test('should handle concurrent requests properly', async() => {
      const mockHTML = testUtils.createMockHTML()

      // Set up mocks for multiple concurrent requests
      for (let i = 0; i < 6; i++) {
        mockedAxios.get
          .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
          .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
          .mockResolvedValueOnce({ status: 200 })
      }

      const requests = []
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .post('/api/audit')
            .send({ url: `https://example${i}.com` })
        )
      }

      const responses = await Promise.all(requests)

      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })
  })

  describe('Performance and Timeout Integration', () => {
    test('should complete audit within reasonable time', async() => {
      const mockHTML = testUtils.createMockHTML()

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const startTime = Date.now()

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(response.body.success).toBe(true)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    test('should handle slow external requests', async() => {
      const mockHTML = testUtils.createMockHTML()

      // Mock slow response
      mockedAxios.get
        .mockImplementationOnce(() =>
          new Promise(resolve =>
            setTimeout(() => resolve(testUtils.createMockAxiosResponse(mockHTML)), 2000)
          )
        )
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 })

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://slow-example.com' })
        .expect(200)

      expect(response.body.success).toBe(true)
    }, 15000) // Increase timeout for this test
  })
})
