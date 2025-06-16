const request = require('supertest')
const axios = require('axios')

// Mock axios before requiring the server
jest.mock('axios')
const mockedAxios = axios

// Mock the server module
let app

describe('Server Unit Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Reset modules to get fresh instance
    jest.resetModules()

    // Require server after mocks are set up
    app = require('../../server')
  })

  afterEach(() => {
    // Clean up any server instances
    if (app && app.close) {
      app.close()
    }
  })

  describe('Health Check Endpoint', () => {
    test('GET /api/health should return status 200', async() => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
        environment: 'test'
      })
      expect(response.body.timestamp).toBeDefined()
      expect(response.body.uptime).toBeDefined()
    })
  })

  describe('Homepage Route', () => {
    test('GET / should render index page', async() => {
      const response = await request(app)
        .get('/')
        .expect(200)

      expect(response.text).toContain('AIO Ready')
      expect(response.text).toContain('Audit your website')
    })

    test('GET / should handle query parameters', async() => {
      const response = await request(app)
        .get('/?url=https%3A%2F%2Fexample.com')
        .expect(200)

      expect(response.text).toContain('AIO Ready')
    })
  })

  describe('Audit API Endpoint', () => {
    test('POST /api/audit should validate URL input', async() => {
      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'invalid-url' })
        .expect(400)

      expect(response.body).toMatchObject({
        error: 'Invalid URL provided',
        message: expect.stringContaining('valid URL')
      })
    })

    test('POST /api/audit should handle missing URL', async() => {
      const response = await request(app)
        .post('/api/audit')
        .send({})
        .expect(400)

      expect(response.body.error).toContain('Invalid URL')
    })

    test('POST /api/audit should handle successful audit', async() => {
      // Mock successful axios responses
      const mockHTML = testUtils.createMockHTML({
        hasStructuredData: true,
        hasSemanticElements: true
      })

      mockedAxios.get
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse(mockHTML))
        .mockResolvedValueOnce(testUtils.createMockAxiosResponse('User-agent: *\nAllow: /'))
        .mockResolvedValueOnce({ status: 200 }) // sitemap check

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
          sections: {
            contentStructure: expect.any(Object),
            aiAccessibility: expect.any(Object),
            dataQuality: expect.any(Object),
            performance: expect.any(Object)
          }
        },
        recommendations: expect.any(Array)
      })
    })

    test('POST /api/audit should handle 403 error gracefully', async() => {
      // Mock 403 error
      const error = new Error('Request failed with status code 403')
      error.response = { status: 403 }
      mockedAxios.get.mockRejectedValueOnce(error)

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        warning: expect.stringContaining('Limited analysis'),
        error: expect.stringContaining('403'),
        audit: {
          limited: true,
          overallScore: 'N/A'
        }
      })
    })

    test('POST /api/audit should handle network timeout', async() => {
      const error = new Error('timeout')
      error.code = 'ETIMEDOUT'
      mockedAxios.get.mockRejectedValueOnce(error)

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })
        .expect(200)

      expect(response.body.audit.limited).toBe(true)
      expect(response.body.error).toContain('timeout')
    })
  })

  describe('Rate Limiting', () => {
    test('should allow requests under rate limit', async() => {
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/api/health')
            .expect(200)
        )
      }

      await Promise.all(promises)
    })

    test('should block requests over rate limit', async() => {
      // Simulate hitting rate limit
      const promises = []
      for (let i = 0; i < 12; i++) {
        promises.push(
          request(app)
            .post('/api/audit')
            .send({ url: 'https://example.com' })
        )
      }

      const responses = await Promise.all(promises.map(p => p.catch(e => e)))

      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429)
      expect(rateLimited.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle 404 routes', async() => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404)

      expect(response.text).toContain('Page Not Found')
    })

    test('should handle server errors gracefully', async() => {
      // Mock axios to throw an unexpected error
      mockedAxios.get.mockRejectedValueOnce(new Error('Unexpected server error'))

      const response = await request(app)
        .post('/api/audit')
        .send({ url: 'https://example.com' })

      expect([200, 500]).toContain(response.status)
      if (response.status === 500) {
        expect(response.body.error).toBeDefined()
      }
    })
  })

  describe('Static Routes', () => {
    test('GET /about should render about page', async() => {
      const response = await request(app)
        .get('/about')
        .expect(200)

      expect(response.text).toContain('About AIO Ready')
    })

    test('GET /contact should render contact page', async() => {
      const response = await request(app)
        .get('/contact')
        .expect(200)

      expect(response.text).toContain('Contact')
    })

    test('GET /api/docs should render API documentation', async() => {
      const response = await request(app)
        .get('/api/docs')
        .expect(200)

      expect(response.text).toContain('API Documentation')
    })
  })
})
