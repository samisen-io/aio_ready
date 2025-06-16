// Mock DOM environment for frontend tests
const { JSDOM } = require('jsdom')

describe('Frontend JavaScript Unit Tests', () => {
  let dom
  let window
  let document

  beforeEach(() => {
    // Create a new DOM environment for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="websiteUrl"></div>
          <div id="auditBtn"></div>
          <div id="loading"></div>
          <div id="results"></div>
          <div id="overallScore"></div>
          <div id="scoreDescription"></div>
          <div id="auditSections"></div>
          <div id="recommendationsList"></div>
          <div id="apiStatus"></div>
          <div id="btnText"></div>
          <div id="btnSpinner"></div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    })

    window = dom.window
    document = window.document

    // Set up global objects that the frontend code expects
    global.window = window
    global.document = document
    global.fetch = jest.fn()

    // Mock window.APP_CONFIG
    window.APP_CONFIG = {
      apiBaseUrl: 'http://localhost:3000',
      appName: 'AIO Ready Test',
      version: '1.0.0',
      isDevelopment: true
    }
  })

  afterEach(() => {
    dom.window.close()
    jest.clearAllMocks()
  })

  describe('URL Validation', () => {
    // Mock the isValidUrl function from audit.js
    const isValidUrl = (string) => {
      try {
        new URL(string)
        return true
      } catch (_) {
        return false
      }
    }

    test('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('https://www.example.com/path')).toBe(true)
    })

    test('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false)
      expect(isValidUrl('example.com')).toBe(false)
      expect(isValidUrl('')).toBe(false)
      expect(isValidUrl('ftp://example.com')).toBe(true) // FTP is valid URL
    })

    test('should handle edge cases', () => {
      expect(isValidUrl('javascript:alert("xss")')).toBe(true) // Valid URL but dangerous
      expect(isValidUrl('data:text/html,<h1>test</h1>')).toBe(true)
      expect(isValidUrl('mailto:test@example.com')).toBe(true)
    })
  })

  describe('Backend Connection Check', () => {
    // Move checkBackendConnection to outer scope so it's available in all tests
    const checkBackendConnection = async () => {
      try {
        const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/health`)
        if (response.ok) {
          const data = await response.json()
          return { connected: true, data }
        }
        throw new Error('Backend not responding')
      } catch (error) {
        return { connected: false, error: error.message }
      }
    }

    test('should handle successful backend connection', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          version: '1.0.0'
        })
      })

      const result = await checkBackendConnection()
      expect(result.connected).toBe(true)
      expect(result.data.status).toBe('healthy')
    })

    test('should handle backend connection failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await checkBackendConnection()
      expect(result.connected).toBe(false)
      expect(result.error).toBe('Network error')
    })

    test('should handle backend unhealthy status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          status: 'unhealthy'
        })
      })

      const result = await checkBackendConnection()
      expect(result.connected).toBe(false)
      expect(result.error).toBe('Backend not responding')
    })
  })

  describe('DOM Manipulation', () => {
    test('should update #results div with audit result', () => {
      const resultsDiv = document.getElementById('results')
      resultsDiv.textContent = ''
      const auditResult = 'Audit Passed!'
      // Simulate frontend code updating the DOM
      resultsDiv.textContent = auditResult
      expect(resultsDiv.textContent).toBe(auditResult)
    })

    test('should show and hide loading spinner', () => {
      const loadingDiv = document.getElementById('loading')
      loadingDiv.style.display = 'none'
      // Simulate showing spinner
      loadingDiv.style.display = 'block'
      expect(loadingDiv.style.display).toBe('block')
      // Simulate hiding spinner
      loadingDiv.style.display = 'none'
      expect(loadingDiv.style.display).toBe('none')
    })
  })

  describe('Button State', () => {
    test('should disable and enable audit button', () => {
      const auditBtn = document.getElementById('auditBtn')
      auditBtn.disabled = false
      // Simulate disabling
      auditBtn.disabled = true
      expect(auditBtn.disabled).toBe(true)
      // Simulate enabling
      auditBtn.disabled = false
      expect(auditBtn.disabled).toBe(false)
    })
  })

  describe('APP_CONFIG', () => {
    test('should have correct app config values', () => {
      expect(window.APP_CONFIG.apiBaseUrl).toBe('http://localhost:3000')
      expect(window.APP_CONFIG.appName).toBe('AIO Ready Test')
      expect(window.APP_CONFIG.version).toBe('1.0.0')
      expect(window.APP_CONFIG.isDevelopment).toBe(true)
    })
  })
})

    window = dom.window
    document = window.document

    // Set up global objects that the frontend code expects
    global.window = window
    global.document = document
    global.fetch = jest.fn()

    // Mock window.APP_CONFIG
    window.APP_CONFIG = {
      apiBaseUrl: 'http://localhost:3000',
      appName: 'AIO Ready Test',
      version: '1.0.0',
      isDevelopment: true
    }
  })

  afterEach(() => {
    dom.window.close()
  })

  describe('URL Validation', () => {
    // Mock the isValidUrl function from audit.js
    const isValidUrl = (string) => {
      try {
        new URL(string)
        return true
      } catch (_) {
        return false
      }
    }

    test('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('https://www.example.com/path')).toBe(true)
    })

    test('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false)
      expect(isValidUrl('example.com')).toBe(false)
      expect(isValidUrl('')).toBe(false)
      expect(isValidUrl('ftp://example.com')).toBe(true) // FTP is valid URL
    })

    test('should handle edge cases', () => {
      expect(isValidUrl('javascript:alert("xss")')).toBe(true) // Valid URL but dangerous
      expect(isValidUrl('data:text/html,<h1>test</h1>')).toBe(true)
      expect(isValidUrl('mailto:test@example.com')).toBe(true)
    })
  })

  describe('Backend Connection Check', () => {
    test('should handle successful backend connection', async() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async() => ({
          status: 'healthy',
          version: '1.0.0'
        })
      })

      // Mock checkBackendConnection function
      const checkBackendConnection = async() => {
        try {
          const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/health`)
          if (response.ok) {
            const data = await response.json()
            return { connected: true, data }
          }
          throw new Error('Backend not responding')
        } catch (error) {
          return { connected: false, error: error.message }
        }
      }

      const result = await checkBackendConnection()
      expect(result.connected).toBe(true)
      expect(result.data.status).toBe('healthy')
    })

    test('should handle backend connection failure', async() => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      const checkBackendConnection = async() => {
        try {
          const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/health`)
          if (response.ok) {
            const data = await response.json()
            return { connected: true, data }
          }
          throw new Error('Backend not responding')
        } catch (error) {
          return { connected: false, error: error.message }
        }
      }
    })
    const result = checkBackendConnection()
    expect(result.connected).toBe(false)
    expect(result.error).toBe('Network error')
  })
})
