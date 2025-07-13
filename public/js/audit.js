let auditData = {};
let isBackendConnected = false;

// Initialize the audit app
function initializeAuditApp() {
    checkBackendConnection();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Allow Enter key to trigger audit
    const urlInput = document.getElementById('websiteUrl');
    if (urlInput) {
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                startAudit();
            }
        });

        // Form validation
        urlInput.addEventListener('input', function(e) {
            const url = e.target.value;
            const auditBtn = document.getElementById('auditBtn');
            
            if (url && isValidUrl(url)) {
                auditBtn.disabled = false;
            } else {
                auditBtn.disabled = url.length > 0; // Disable only if there's invalid input
            }
        });
    }
}

// Validate URL format
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Check backend connection on page load
async function checkBackendConnection() {
    const apiStatus = document.getElementById('apiStatus');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/health`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            isBackendConnected = true;
            apiStatus.className = 'api-status connected';
            apiStatus.innerHTML = `✅ Backend connected - Real-time analysis available (v${data.version || 'unknown'})`;
        } else {
            throw new Error('Backend not responding');
        }
    } catch (error) {
        isBackendConnected = false;
        apiStatus.className = 'api-status disconnected';
        apiStatus.innerHTML = '❌ Backend disconnected - Analysis unavailable';
        
        if (window.APP_CONFIG.isDevelopment) {
            console.warn('Backend connection failed:', error.message);
        }
    }
}

// Animate loading steps
function animateLoadingSteps() {
    const steps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8', 'step9', 'step10'];
    let currentStep = 0;

    const interval = setInterval(() => {
        // Remove active class from all steps
        steps.forEach(step => {
            const element = document.getElementById(step);
            if (element) {
                element.classList.remove('active');
            }
        });

        // Add active class to current step
        if (currentStep < steps.length) {
            const element = document.getElementById(steps[currentStep]);
            if (element) {
                element.classList.add('active');
            }
            currentStep++;
        } else {
            clearInterval(interval);
        }
    }, 600); // Slightly faster for more steps

    return interval;
}

// Main audit function
async function startAudit() {
    const url = document.getElementById('websiteUrl').value.trim();
    if (!url) {
        alert('Please enter a valid URL');
        return;
    }

    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (including http:// or https://)');
        return;
    }

    // Check if backend is connected
    if (!isBackendConnected) {
        alert('Backend server is not connected. Please ensure the server is running and try again.');
        return;
    }

    // Show loading state
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('auditBtn').disabled = true;
    document.getElementById('btnText').style.display = 'none';
    document.getElementById('btnSpinner').style.display = 'inline';

    // Start loading animation
    const loadingInterval = animateLoadingSteps();

    try {
        // Use real backend API
        const response = await fetch(`${window.APP_CONFIG.apiBaseUrl}/api/audit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            auditData = data.audit;
            auditData.recommendations = data.recommendations;
            displayAuditResults();
        } else {
            throw new Error(data.error || data.message || 'Audit failed');
        }
        
    } catch (error) {
        console.error('Audit failed:', error);
        clearInterval(loadingInterval);
        
        // Show specific error message
        let errorMessage = 'Audit failed: ' + error.message;
        
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
            errorMessage = 'Cannot connect to the analysis server. Please ensure the backend is running and try again.';
        } else if (error.message.includes('403')) {
            errorMessage = 'Access denied: The website is blocking automated analysis. This is common for sites with bot protection.';
        } else if (error.message.includes('404')) {
            errorMessage = 'Page not found: The URL does not exist or is not accessible.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Analysis timeout: The website took too long to respond. Please try again.';
        }
        
        alert(errorMessage);
    } finally {
        clearInterval(loadingInterval);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('auditBtn').disabled = false;
        document.getElementById('btnText').style.display = 'inline';
        document.getElementById('btnSpinner').style.display = 'none';
    }
}

// Display audit results
function displayAuditResults() {
    // Update overall score
    const overallScore = auditData.overallScore;
    const scoreElement = document.getElementById('overallScore');
    
    if (overallScore === 'N/A' || auditData.limited) {
        scoreElement.textContent = 'N/A';
        scoreElement.style.fontSize = '2.5rem';
    } else {
        scoreElement.textContent = overallScore;
        scoreElement.style.fontSize = '4rem';
    }
    
    // Update score description
    const scoreDescription = document.getElementById('scoreDescription');
    if (auditData.limited) {
        scoreDescription.textContent = '⚠️ Limited analysis - website access restricted';
    } else if (overallScore >= 90) {
        scoreDescription.textContent = '🎉 Excellent AI optimization!';
    } else if (overallScore >= 80) {
        scoreDescription.textContent = '✅ Good AI readiness with room for improvement';
    } else if (overallScore >= 70) {
        scoreDescription.textContent = '⚠️ Moderate AI readiness - several improvements needed';
    } else if (overallScore >= 60) {
        scoreDescription.textContent = '🔧 Poor AI readiness - significant improvements required';
    } else {
        scoreDescription.textContent = '❌ Very poor AI readiness - major overhaul needed';
    }
    
    // Clear and populate sections
    const sectionsContainer = document.getElementById('auditSections');
    sectionsContainer.innerHTML = '';
    
    Object.entries(auditData.sections).forEach(([key, section]) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'audit-section';
        
        let scoreClass = 'needs-work';
        let scoreDisplay = section.score;
        
        if (section.score === 'N/A') {
            scoreClass = 'unavailable';
            scoreDisplay = 'N/A';
        } else if (section.score >= 90) {
            scoreClass = 'excellent';
            scoreDisplay = section.score + '/100';
        } else if (section.score >= 70) {
            scoreClass = 'good';
            scoreDisplay = section.score + '/100';
        } else {
            scoreDisplay = section.score + '/100';
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
        `;
        
        sectionsContainer.appendChild(sectionDiv);
    });
    
    // Generate recommendations
    generateRecommendations();
    
    // Show results with smooth animation
    const resultsEl = document.getElementById('results');
    resultsEl.style.display = 'block';
    resultsEl.style.opacity = '0';
    resultsEl.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        resultsEl.style.transition = 'all 0.5s ease';
        resultsEl.style.opacity = '1';
        resultsEl.style.transform = 'translateY(0)';
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Generate recommendations
function generateRecommendations() {
    // Use recommendations from backend if available
    if (auditData.recommendations && auditData.recommendations.length > 0) {
        const recommendationsContainer = document.getElementById('recommendationsList');
        recommendationsContainer.innerHTML = auditData.recommendations.map(rec => `
            <div class="recommendation ${rec.priority || ''}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                ${rec.impact ? `<small style="color: #666; font-style: italic;">Impact: ${rec.impact}</small>` : ''}
            </div>
        `).join('');
    } else {
        // Generate recommendations based on failed checks
        const recommendations = generateFallbackRecommendations();
        
        const recommendationsContainer = document.getElementById('recommendationsList');
        recommendationsContainer.innerHTML = recommendations.map(rec => `
            <div class="recommendation ${rec.priority || ''}">
                <h4>${rec.title}</h4>
                <p>${rec.description}</p>
                ${rec.impact ? `<small style="color: #666; font-style: italic;">Impact: ${rec.impact}</small>` : ''}
            </div>
        `).join('');
    }
}

// Generate fallback recommendations based on audit results
function generateFallbackRecommendations() {
    const recommendations = [];
    const failedChecks = [];
    const warningChecks = [];
    
    // Collect failed and warning checks
    Object.values(auditData.sections).forEach(section => {
        section.checks.forEach(check => {
            if (check.status === 'fail') {
                failedChecks.push(check);
            } else if (check.status === 'warning') {
                warningChecks.push(check);
            }
        });
    });
    
    // Generate specific recommendations based on failed checks
    failedChecks.forEach(check => {
        switch (check.name) {
            case 'Structured Data':
                recommendations.push({
                    priority: 'high',
                    title: 'Implement Schema.org Structured Data',
                    description: 'Add JSON-LD structured data to help AI agents understand your content better. Start with Organization, WebSite, and Article schemas.',
                    impact: 'High - Significantly improves AI content understanding'
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
            case 'Heading Hierarchy':
                recommendations.push({
                    priority: 'medium',
                    title: 'Improve Heading Structure',
                    description: 'Use proper H1-H6 heading hierarchy. Ensure single H1 per page and logical heading progression.',
                    impact: 'Medium - Helps AI understand content structure'
                });
                break;
            case 'Content Without JS':
                recommendations.push({
                    priority: 'medium',
                    title: 'Improve Content Accessibility',
                    description: 'Ensure critical content is available without JavaScript execution for better AI crawling.',
                    impact: 'Medium - Enables AI access to full content'
                });
                break;
        }
    });
    
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
                    });
                }
                break;
            case 'Meta Descriptions':
                if (!recommendations.some(r => r.title.includes('Meta'))) {
                    recommendations.push({
                        priority: 'low',
                        title: 'Optimize Meta Descriptions',
                        description: 'Ensure all pages have unique, descriptive meta descriptions between 120-160 characters.',
                        impact: 'Low - Improves content discovery'
                    });
                }
                break;
        }
    });
    
    // Add general recommendations if score is low
    if (auditData.overallScore < 70) {
        recommendations.unshift({
            priority: 'high',
            title: 'Comprehensive AI Readiness Improvement',
            description: 'Your website needs significant improvements for AI optimization. Focus on structured data, content accessibility, and performance optimization.',
            impact: 'High - Overall site improvement needed'
        });
    }
    
    // Add performance recommendations
    if (auditData.sections.performance && auditData.sections.performance.score < 80) {
        recommendations.push({
            priority: 'medium',
            title: 'Optimize Site Performance',
            description: 'Improve page load speeds, enable compression, and implement proper caching strategies for better AI crawling efficiency.',
            impact: 'Medium - Improves crawling efficiency'
        });
    }
    
    return recommendations.slice(0, 6); // Limit to top 6 recommendations
}

// Export audit results
function exportResults() {
    if (!auditData) {
        alert('No audit results to export');
        return;
    }

    const reportData = {
        ...auditData,
        exportedAt: new Date().toISOString(),
        exportedBy: window.APP_CONFIG.appName,
        exportVersion: window.APP_CONFIG.version
    };

    // Create downloadable JSON report
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aio-audit-${auditData.domain}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    showNotification('Report exported successfully!', 'success');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    let backgroundColor;
    switch(type) {
        case 'success':
            backgroundColor = '#28a745';
            break;
        case 'error':
            backgroundColor = '#dc3545';
            break;
        case 'warning':
            backgroundColor = '#ffc107';
            notification.style.color = '#856404';
            break;
        default:
            backgroundColor = '#17a2b8';
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
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Reset form for new audit
function runNewAudit() {
    document.getElementById('results').style.display = 'none';
    document.getElementById('websiteUrl').value = '';
    document.getElementById('websiteUrl').focus();
    auditData = {};
    
    // Reset any loading states
    document.getElementById('loading').style.display = 'none';
    document.getElementById('auditBtn').disabled = false;
    document.getElementById('btnText').style.display = 'inline';
    document.getElementById('btnSpinner').style.display = 'none';
}

// Set example URL
function setExampleUrl(url) {
    document.getElementById('websiteUrl').value = url;
    document.getElementById('websiteUrl').focus();
    document.getElementById('auditBtn').disabled = false;
}

// Utility function to format timestamps
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}