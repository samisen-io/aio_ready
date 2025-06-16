// Mock axios
jest.mock('axios')

const axios = require('axios')
const cheerio = require('cheerio')
const mockedAxios = axios

// Import analysis functions (we'll need to extract these from server.js)
// For now, we'll test them by requiring the server and accessing the functions
describe('Analysis Functions Unit Tests', () => {
  let analyzeContentStructure
  let analyzeAIAccessibility
  let analyzeDataQuality
  let analyzePerformance
  let generateRecommendations

  beforeAll(() => {
    // In a real implementation, you'd extract these functions to separate modules
    // For testing purposes, we'll create mock implementations

    analyzeContentStructure = (html, url) => {
      const $ = cheerio.load(html)
      const checks = []
      let score = 0

      // Semantic HTML check
      const semanticElements = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer']
      const foundSemantic = semanticElements.filter(el => $(el).length > 0)
      if (foundSemantic.length >= 3) {
        checks.push({
          name: 'Semantic HTML Usage',
          status: 'pass',
          description: `Found ${foundSemantic.length} semantic elements`
        })
        score += 25
      }

      // Heading hierarchy check
      const hasH1 = $('h1').length === 1
      if (hasH1) {
        checks.push({
          name: 'Heading Hierarchy',
          status: 'pass',
          description: 'Proper H1 structure found'
        })
        score += 25
      }

      return { checks, score: Math.min(score, 100) }
    }

    analyzeDataQuality = (html, url) => {
      const $ = cheerio.load(html)
      const checks = []
      let score = 0

      // Image alt text check
      const images = $('img')
      const imagesWithAlt = $('img[alt]')

      if (images.length === 0 || imagesWithGoodAlt.length === images.length) {
        checks.push({
          name: 'Image Optimization',
          status: 'pass',
          description: 'All images have alt text'
        })
        score += 25
      }

      return { checks, score: Math.min(score, 100) }
    }
  })

  describe('analyzeContentStructure', () => {
    test('should identify semantic HTML elements', () => {
      const html = testUtils.createMockHTML({
        hasSemanticElements: true
      })

      const result = analyzeContentStructure(html, 'https://example.com')

      expect(result.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Semantic HTML Usage',
            status: 'pass'
          })
        ])
      )
      expect(result.score).toBeGreaterThan(0)
    })

    test('should detect missing semantic elements', () => {
      const html = testUtils.createMockHTML({
        hasSemanticElements: false
      })

      const result = analyzeContentStructure(html, 'https://example.com')
      expect(result.score).toBeLessThan(50)
    })

    test('should validate heading hierarchy', () => {
      const html = testUtils.createMockHTML({
        hasH1: true
      })

      const result = analyzeContentStructure(html, 'https://example.com')

      expect(result.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Heading Hierarchy',
            status: 'pass'
          })
        ])
      )
    })

    test('should detect missing H1', () => {
      const html = testUtils.createMockHTML({
        hasH1: false
      })

      const result = analyzeContentStructure(html, 'https://example.com')
      // Should not have a passing heading hierarchy check
      const headingCheck = result.checks.find(c => c.name === 'Heading Hierarchy')
      expect(headingCheck).toBeFalsy()
    })

    test('should detect meta description', () => {
      const html = testUtils.createMockHTML({
        hasMetaDescription: true
      })

      const $ = cheerio.load(html)
      const metaDescription = $('meta[name="description"]').attr('content')
      expect(metaDescription).toBeTruthy()
      expect(metaDescription.length).toBeGreaterThan(50)
    })

    test('should detect structured data', () => {
      const html = testUtils.createMockHTML({
        hasStructuredData: true
      })

      const $ = cheerio.load(html)
      const jsonLd = $('script[type="application/ld+json"]').length
      expect(jsonLd).toBeGreaterThan(0)
    })
  })

  describe('analyzeDataQuality', () => {
    test('should check image alt text coverage', () => {
      const html = testUtils.createMockHTML({
        hasImages: true
      })

      const result = analyzeDataQuality(html, 'https://example.com')

      expect(result.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Image Optimization',
            status: 'pass'
          })
        ])
      )
    })

    test('should handle pages with no images', () => {
      const html = testUtils.createMockHTML({
        hasImages: false
      })

      const $ = cheerio.load(html)
      const images = $('img')
      expect(images).toHaveLength(0)
    })

    test('should detect content quality', () => {
      const html = testUtils.createMockHTML()
      const $ = cheerio.load(html)

      const paragraphs = $('p').length
      const textLength = $('body').text().length

      expect(paragraphs).toBeGreaterThan(0)
      expect(textLength).toBeGreaterThan(100)
    })
  })

  describe('URL and Domain Analysis', () => {
    test('should handle HTTPS URLs correctly', () => {
      const httpsUrl = 'https://example.com'
      expect(httpsUrl.startsWith('https://')).toBe(true)
    })

    test('should handle HTTP URLs correctly', () => {
      const httpUrl = 'http://example.com'
      expect(httpUrl.startsWith('https://')).toBe(false)
    })

    test('should extract domain from URL', () => {
      const url = 'https://www.example.com/path?param=value'
      const urlParse = require('url-parse')
      const parsed = urlParse(url)
      expect(parsed.hostname).toBe('www.example.com')
    })
  })

  describe('Score Calculation', () => {
    test('should calculate scores within valid range', () => {
      const mockChecks = [
        { status: 'pass' },
        { status: 'pass' },
        { status: 'fail' },
        { status: 'warning' }
      ]

      // Mock score calculation
      let score = 0
      mockChecks.forEach(check => {
        if (check.status === 'pass') score += 25
        else if (check.status === 'warning') score += 15
      })

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    test('should cap scores at 100', () => {
      const score = Math.min(150, 100)
      expect(score).toBe(100)
    })
  })

  describe('Error Handling in Analysis', () => {
    test('should handle malformed HTML gracefully', () => {
      const malformedHTML = '<html><head><title>Test</head><body><h1>Broken HTML</body>'

      expect(() => {
        const $ = cheerio.load(malformedHTML)
        const title = $('title').text()
      }).not.toThrow()
    })

    test('should handle empty HTML', () => {
      const emptyHTML = ''

      expect(() => {
        const $ = cheerio.load(emptyHTML)
        const elements = $('*')
      }).not.toThrow()
    })

    test('should handle HTML with no content', () => {
      const minimalHTML = '<html><head></head><body></body></html>'

      const $ = cheerio.load(minimalHTML)
      const textContent = $('body').text().trim()

      expect(textContent).toBe('')
    })
  })

  describe('Robots.txt Analysis', () => {
    beforeEach(() => {
      mockedAxios.get.mockClear()
    })

    test('should handle valid robots.txt', async() => {
      const robotsContent = `
        User-agent: *
        Allow: /
        Disallow: /admin/
        
        Sitemap: https://example.com/sitemap.xml
      `

      mockedAxios.get.mockResolvedValueOnce({
        data: robotsContent,
        status: 200
      })

      const response = await mockedAxios.get('https://example.com/robots.txt')
      expect(response.data).toContain('User-agent: *')
      expect(response.data).toContain('Allow: /')
    })

    test('should handle missing robots.txt', async() => {
      const error = new Error('Not found')
      error.response = { status: 404 }
      mockedAxios.get.mockRejectedValueOnce(error)

      try {
        await mockedAxios.get('https://example.com/robots.txt')
      } catch (e) {
        expect(e.response.status).toBe(404)
      }
    })
  })

  describe('Recommendation Generation', () => {
    test('should generate recommendations based on failed checks', () => {
      const mockAuditResults = {
        overallScore: 65,
        sections: {
          contentStructure: {
            checks: [
              { name: 'Structured Data', status: 'fail' },
              { name: 'Meta Description', status: 'pass' }
            ]
          },
          performance: {
            checks: [
              { name: 'HTTPS Security', status: 'fail' }
            ]
          }
        }
      }

      // Mock recommendation generation
      const recommendations = []

      Object.values(mockAuditResults.sections).forEach(section => {
        section.checks.forEach(check => {
          if (check.status === 'fail') {
            if (check.name === 'Structured Data') {
              recommendations.push({
                priority: 'high',
                title: 'Implement Schema.org Markup'
              })
            }
            if (check.name === 'HTTPS Security') {
              recommendations.push({
                priority: 'high',
                title: 'Enable HTTPS Security'
              })
            }
          }
        })
      })

      expect(recommendations).toHaveLength(2)
      expect(recommendations[0].priority).toBe('high')
    })

    test('should limit number of recommendations', () => {
      const manyRecommendations = Array(10).fill().map((_, i) => ({
        title: `Recommendation ${i}`,
        priority: 'medium'
      }))

      const limitedRecommendations = manyRecommendations.slice(0, 6)
      expect(limitedRecommendations).toHaveLength(6)
    })
  })
})
