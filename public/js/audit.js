let auditData = {}
let isBackendConnected = false

// Initialize the audit app
function initializeAuditApp() {
  checkBackendConnection()
  setupEventListeners()
}

// Setup event listeners
function setupEventListeners() {
  // Allow Enter key to trigger audit
  const urlInput = document.getElementById('websiteUrl')
  if (urlInput) {
    urlInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        startAudit()
      }
    })

    // Form validation
    urlInput.addEventListener('input', function(e) {
      const url = e.target.value
      const auditBtn = document.getElementById('auditBtn')

      if (url && isValidUrl(url)) {
        auditBtn.disabled = false
      } else {
        auditBtn.disabled = url.length > 0 // Disable only if there's invalid input
      }
    })
  }
}

// Validate URL format
function isValidUrl(string) {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

// Check backend connection on page load
async function checkBackendConnection() {
  const apiStatus = document.getElementById('apiStatus')
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      isBackendConnected = true
      apiStatus.className = 'api-status connected'
      apiStatus.innerHTML = `✅ Backend connected - Real-time analysis available (v${data.version || 'unknown'})`
    } else {
      throw new Error('Backend not responding')
    }
  } catch (error) {
    isBackendConnected = false
    apiStatus.className = 'api-status demo-mode'
    apiStatus.innerHTML = '⚠️ Backend disconnected - Running in demo mode with sample data'

    if (window.APP_CONFIG.isDevelopment) {
      console.warn('Backend connection failed:', error.message)
    }
  }
}

// Animate loading steps
function animateLoadingSteps() {
  const steps = ['step1', 'step2', 'step3', 'step4']
  let currentStep = 0

  const interval = setInterval(() => {
    // Remove active class from all steps
    steps.forEach(step => {
      document.getElementById(step).classList.remove('active')
    })

    // Add active class to current step
    if (currentStep < steps.length) {
      document.getElementById(steps[currentStep]).classList.add('active')
      currentStep++
    } else {
      clearInterval(interval)
    }
  }, 800)

  return interval
}

// Main audit function
async function startAudit() {
  const url = document.getElementById('websiteUrl').value.trim()
  if (!url) {
    alert('Please enter a valid URL')
    return
  }

  if (!isValidUrl(url)) {
    alert('Please enter a valid URL (including http:// or https://)')
    return
  }

  // Show loading state
  document.getElementById('loading').style.display = 'block'
  document.getElementById('results').style.display = 'none'
  document.getElementById('auditBtn').disabled = true
  document.getElementById('btnText').style.display = 'none'
  document.getElementById('btnSpinner').style.display = 'inline'

  // Start loading animation
  const loadingInterval = animateLoadingSteps()

  try {
    if (isBackendConnected) {
      // Use real backend API
      const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        auditData = data.audit
        auditData.recommendations = data.recommendations
        displayAuditResults()
      } else {
        throw new Error(data.error || data.message || 'Audit failed')
      }
    } else {
      // Fall back to demo mode
      document.getElementById('loadingText').textContent = 'Running in demo mode...'
      await new Promise(resolve => setTimeout(resolve, 4000))
      auditData = generateMockAuditResults(url)
      displayAuditResults()
    }
  } catch (error) {
    console.error('Audit failed:', error)
    clearInterval(loadingInterval)

    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      // Switch to demo mode if API fails
      isBackendConnected = false
      document.getElementById('apiStatus').className = 'api-status demo-mode'
      document.getElementById('apiStatus').innerHTML = '⚠️ Backend disconnected - Falling back to demo mode'
      document.getElementById('loadingText').textContent = 'Switching to demo mode...'

      await new Promise(resolve => setTimeout(resolve, 2000))
      auditData = generateMockAuditResults(url)
      displayAuditResults()
    } else {
      alert('Audit failed: ' + error.message)
    }
  } finally {
    clearInterval(loadingInterval)
    document.getElementById('loading').style.display = 'none'
    document.getElementById('auditBtn').disabled = false
    document.getElementById('btnText').style.display = 'inline'
    document.getElementById('btnSpinner').style.display = 'none'
  }
}

// Generate mock audit results for demo mode
function generateMockAuditResults(url) {
  const domain = new URL(url).hostname
  const baseScore = Math.floor(Math.random() * 30) + 60 // 60-90 base score

  return {
    url,
    domain,
    timestamp: new Date().toISOString(),
    overallScore: baseScore + Math.floor(Math.random() * 10),
    sections: {
      contentStructure: {
        title: 'Content Structure & Markup',
        score: baseScore + Math.floor(Math.random() * 20) - 10,
        checks: [
          {
            name: 'Semantic HTML Usage',
            status: Math.random() > 0.3 ? 'pass' : 'warning',
            description: 'Website uses proper HTML5 semantic elements'
          },
          {
            name: 'Heading Hierarchy',
            status: Math.random() > 0.2 ? 'pass' : 'fail',
            description: 'Clear H1-H6 structure found'
          },
          {
            name: 'Meta Descriptions',
            status: Math.random() > 0.4 ? 'warning' : 'pass',
            description: 'Some pages missing meta descriptions'
          },
          {
            name: 'Structured Data',
            status: Math.random() > 0.6 ? 'fail' : 'pass',
            description: domain.includes('github') || domain.includes('wikipedia') ? 'Schema.org markup detected' : 'No Schema.org markup detected'
          }
        ]
      },
      aiAccessibility: {
        title: 'AI Agent Accessibility',
        score: baseScore + Math.floor(Math.random() * 15) - 5,
        checks: [
          {
            name: 'Robots.txt Present',
            status: 'pass',
            description: 'Valid robots.txt file found'
          },
          {
            name: 'Crawl Rate Friendly',
            status: 'pass',
            description: 'Server responds well to requests'
          },
          {
            name: 'Content Without JS',
            status: Math.random() > 0.5 ? 'warning' : 'pass',
            description: 'Some content requires JavaScript'
          },
          {
            name: 'XML Sitemap',
            status: Math.random() > 0.3 ? 'pass' : 'warning',
            description: 'XML sitemap found at standard location'
          }
        ]
      },
      dataQuality: {
        title: 'Data Quality & Format',
        score: baseScore + Math.floor(Math.random() * 25) - 10,
        checks: [
          {
            name: 'Content Format Quality',
            status: 'pass',
            description: 'Content is well-formatted and readable'
          },
          {
            name: 'Image Optimization',
            status: Math.random() > 0.4 ? 'warning' : 'pass',
            description: 'Some images missing alt attributes'
          },
          {
            name: 'Contact Information',
            status: Math.random() > 0.3 ? 'pass' : 'warning',
            description: 'Clear contact details available'
          },
          {
            name: 'Content Consistency',
            status: Math.random() > 0.4 ? 'pass' : 'warning',
            description: 'Data structure varies across pages'
          }
        ]
      },
      performance: {
        title: 'Performance & Speed',
        score: baseScore + Math.floor(Math.random() * 20),
        checks: [
          {
            name: 'HTTPS Security',
            status: url.startsWith('https') ? 'pass' : 'fail',
            description: url.startsWith('https') ? 'Site uses secure HTTPS protocol' : 'Site does not use HTTPS'
          },
          {
            name: 'Mobile Responsiveness',
            status: 'pass',
            description: 'Website is mobile-friendly'
          },
          {
            name: 'Content Compression',
            status: Math.random() > 0.3 ? 'pass' : 'warning',
            description: 'Content compression detected'
          },
          {
            name: 'Caching Strategy',
            status: Math.random() > 0.4 ? 'pass' : 'warning',
            description: 'Caching headers present'
          }
        ]
      }
    }
  }
}

// Display audit results
function displayAuditResults() {
  // Update overall score
  const overallScore = auditData.overallScore
  const scoreElement = document.getElementById('overallScore')

  if (overallScore === 'N/A' || auditData.limited) {
    scoreElement.textContent = 'N/A'
    scoreElement.style.fontSize = '2.5rem'
  } else {
    scoreElement.textContent = overallScore
    scoreElement.style.fontSize = '4rem'
  }

  // Update score description
  const scoreDescription = document.getElementById('scoreDescription')
  if (auditData.limited) {
    scoreDescription.textContent = '⚠️ Limited analysis - website access restricted'
  } else if (overallScore >= 90) {
    scoreDescription.textContent = '🎉 Excellent AI optimization!'
  } else if (overallScore >= 80) {
    scoreDescription.textContent = '✅ Good AI readiness with room for improvement'
  } else if (overallScore >= 70) {
    scoreDescription.textContent = '⚠️ Moderate AI readiness - several improvements needed'
  } else if (overallScore >= 60) {
    scoreDescription.textContent = '🔧 Poor AI readiness - significant improvements required'
  } else {
    scoreDescription.textContent = '❌ Very poor AI readiness - major overhaul needed'
  }

  // Clear and populate sections
  const sectionsContainer = document.getElementById('auditSections')
  sectionsContainer.innerHTML = ''

  Object.entries(auditData.sections).forEach(([key, section]) => {
    const sectionDiv = document.createElement('div')
    sectionDiv.className = 'audit-section'

    let scoreClass = 'needs-work'
    let scoreDisplay = section.score

    if (section.score === 'N/A') {
      scoreClass = 'unavailable'
      scoreDisplay = 'N/A'
    } else if (section.score >= 90) {
      scoreClass = 'excellent'
      scoreDisplay = section.score + '/100'
    } else if (section.score >= 70) {
      scoreClass = 'good'
      scoreDisplay = section.score + '/100'
    } else {
      scoreDisplay = section.score + '/100'
    }

    sectionDiv.innerHTML = `
            <div class="section-header">
                <div class="section-title">${section.title}</div>
                <div class="section-score ${scoreClass}">${scoreDisplay}</div>
            </div>
            ${section.checks.map(check => `
                <div class="check-item">
                    <div class="check-icon ${check.status}">
                        ${check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!'}
                    </div>
                    <div>
                        <strong>${check.name}</strong><br>
                        <small style="color: #666;">${check.description}</small>
                    </div>
                </div>
            `).join('')}
        `

    sectionsContainer.appendChild(sectionDiv)
  })

  // Generate recommendations
  generateRecommendations()

  // Show results with smooth animation
  const resultsEl = document.getElementById('results')
  resultsEl.style.display = 'block'
  resultsEl.style.opacity = '0'
  resultsEl.style.transform = 'translateY(20px)'

  setTimeout(() => {
    resultsEl.style.transition = 'all 0.5s ease'
    resultsEl.style.opacity = '1'
    resultsEl.style.transform = 'translateY(0)'
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

// Generate recommendations
function generateRecommendations() {
  // Use recommendations from backend if available
  if (auditData.recommendations && auditData.recommendations.length > 0) {
    const recommendationsContainer = document.getElementById('recommendationsList')
    recommendationsContainer.innerHTML = auditData.recommendations.map(rec => `
            <div class="recommendation ${rec.priority || ''}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                ${rec.impact ? `<small style="color: #666; font-style: italic;">Impact: ${rec.impact}</small>` : ''}
            </div>
        `).join('')
  } else {
    // Generate recommendations based on failed checks
    const recommendations = generateFallbackRecommendations()

    const recommendationsContainer = document.getElementById('recommendationsList')
    recommendationsContainer.innerHTML = recommendations.map(rec => `
            <div class="recommendation ${rec.priority || ''}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                ${rec.impact ? `<small style="color: #666; font-style: italic;">Impact: ${rec.impact}</small>` : ''}
            </div>
        `).join('')
  }
}

// Generate fallback recommendations based on audit results
function generateFallbackRecommendations() {
  const recommendations = []
  const failedChecks = []
  const warningChecks = []

  // Collect failed and warning checks
  Object.values(auditData.sections).forEach(section => {
    section.checks.forEach(check => {
      if (check.status === 'fail') {
        failedChecks.push(check)
      } else if (check.status === 'warning') {
        warningChecks.push(check)
      }
    })
  })

  // Generate specific recommendations based on failed checks
  failedChecks.forEach(check => {
    switch (check.name) {
      case 'Structured Data':
        recommendations.push({
          priority: 'high',
          title: 'Implement Schema.org Structured Data',
          description: 'Add JSON-LD structured data to help AI agents understand your content better. Start with Organization, WebSite, and Article schemas.',
          impact: 'High - Significantly improves AI content understanding'
        })
        break
      case 'HTTPS Security':
        recommendations.push({
          priority: 'high',
          title: 'Enable HTTPS Security',
          description: 'Migrate to HTTPS to ensure secure connections. AI agents prefer secure endpoints for data exchange.',
          impact: 'High - Essential for AI agent trust and security'
        })
        break
      case 'Heading Hierarchy':
        recommendations.push({
          priority: 'medium',
          title: 'Improve Heading Structure',
          description: 'Use proper H1-H6 heading hierarchy. Ensure single H1 per page and logical heading progression.',
          impact: 'Medium - Helps AI understand content structure'
        })
        break
      case 'Content Without JS':
        recommendations.push({
          priority: 'medium',
          title: 'Improve Content Accessibility',
          description: 'Ensure critical content is available without JavaScript execution for better AI crawling.',
          impact: 'Medium - Enables AI access to full content'
        })
        break
    }
  })

  // Add recommendations for warning checks
  warningChecks.forEach(check => {
    switch (check.name) {
      case 'Image Optimization':
        if (!recommendations.some(r => r.title.includes('Image'))) {
          recommendations.push({
            priority: 'medium',
            title: 'Complete Image Alt Text',
            description: 'Add descriptive alt text to all images. This helps AI agents understand visual content and improves accessibility.',
            impact: 'Medium - Enhances content comprehension for AI'
          })
        }
        break
      case 'Meta Descriptions':
        if (!recommendations.some(r => r.title.includes('Meta'))) {
          recommendations.push({
            priority: 'low',
            title: 'Optimize Meta Descriptions',
            description: 'Ensure all pages have unique, descriptive meta descriptions between 120-160 characters.',
            impact: 'Low - Improves content discovery'
          })
        }
        break
    }
  })

  // Add general recommendations if score is low
  if (auditData.overallScore < 70) {
    recommendations.unshift({
      priority: 'high',
      title: 'Comprehensive AI Readiness Improvement',
      description: 'Your website needs significant improvements for AI optimization. Focus on structured data, content accessibility, and performance optimization.',
      impact: 'High - Overall site improvement needed'
    })
  }

  // Add performance recommendations
  if (auditData.sections.performance.score < 80) {
    recommendations.push({
      priority: 'medium',
      title: 'Optimize Site Performance',
      description: 'Improve page load speeds, enable compression, and implement proper caching strategies for better AI crawling efficiency.',
      impact: 'Medium - Improves crawling efficiency'
    })
  }

  return recommendations.slice(0, 6) // Limit to top 6 recommendations
}

// Export audit results
function exportResults() {
  if (!auditData) {
    alert('No audit results to export')
    return
  }

  const reportData = {
    ...auditData,
    exportedAt: new Date().toISOString(),
    exportedBy: window.APP_CONFIG.appName,
    exportVersion: window.APP_CONFIG.version
  }

  // Create downloadable JSON report
  const blob = new Blob([JSON.stringify(reportData, null, 2)], {
    type: 'application/json'
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aio-audit-${auditData.domain}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  // Show success message
  showNotification('Report exported successfully!', 'success')
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div')
  notification.className = `notification ${type}`
  notification.textContent = message

  let backgroundColor
  switch (type) {
    case 'success':
      backgroundColor = '#28a745'
      break
    case 'error':
      backgroundColor = '#dc3545'
      break
    case 'warning':
      backgroundColor = '#ffc107'
      notification.style.color = '#856404'
      break
    default:
      backgroundColor = '#17a2b8'
  }

  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: ${type === 'warning' ? '#856404' : 'white'};
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        word-wrap: break-word;
    `

  document.body.appendChild(notification)

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)'
  }, 100)

  // Animate out and remove
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)'
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification)
      }
    }, 300)
  }, 5000)
}

// Reset form for new audit
function runNewAudit() {
  document.getElementById('results').style.display = 'none'
  document.getElementById('websiteUrl').value = ''
  document.getElementById('websiteUrl').focus()
  auditData = {}

  // Reset any loading states
  document.getElementById('loading').style.display = 'none'
  document.getElementById('auditBtn').disabled = false
  document.getElementById('btnText').style.display = 'inline'
  document.getElementById('btnSpinner').style.display = 'none'
}

// Set example URL
function setExampleUrl(url) {
  document.getElementById('websiteUrl').value = url
  document.getElementById('websiteUrl').focus()
  document.getElementById('auditBtn').disabled = false
}

// Utility function to format timestamps
function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString()
}

export {
  initializeAuditApp,
  startAudit,
  exportResults,
  runNewAudit,
  setExampleUrl,
  showNotification,
  formatTimestamp
}
