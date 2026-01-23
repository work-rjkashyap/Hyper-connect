// Smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault()
    const target = document.querySelector(this.getAttribute('href'))
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }
  })
})

// Navbar scroll effect
let lastScroll = 0
const navbar = document.querySelector('.navbar')

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset

  if (currentScroll <= 0) {
    navbar.style.boxShadow = 'none'
  } else {
    navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.4)'
  }

  lastScroll = currentScroll
})

// Intersection Observer for fade-in animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1'
      entry.target.style.transform = 'translateY(0)'
    }
  })
}, observerOptions)

// Apply fade-in to feature cards and integration logos
document.addEventListener('DOMContentLoaded', () => {
  const animatedElements = document.querySelectorAll('.feature-card, .integration-logo')

  animatedElements.forEach((el, index) => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(20px)'
    el.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`
    observer.observe(el)
  })
})

// Add copy functionality to code blocks
const codeContent = document.querySelector('.code-content')
if (codeContent) {
  const copyButton = document.createElement('button')
  copyButton.className = 'copy-button'
  copyButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2z"/>
            <path d="M2 6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1H6a3 3 0 0 1-3-3V6H2z"/>
        </svg>
        Copy
    `
  copyButton.style.cssText = `
        position: absolute;
        top: 1rem;
        right: 1rem;
        padding: 0.5rem 1rem;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        transition: all 0.3s ease;
    `

  const codePreview = document.querySelector('.code-preview')
  codePreview.style.position = 'relative'
  codePreview.appendChild(copyButton)

  copyButton.addEventListener('click', async () => {
    const code = codeContent.textContent
    try {
      await navigator.clipboard.writeText(code)
      copyButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
                Copied!
            `
      copyButton.style.background = 'var(--accent-primary)'
      copyButton.style.color = 'white'

      setTimeout(() => {
        copyButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2z"/>
                        <path d="M2 6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1H6a3 3 0 0 1-3-3V6H2z"/>
                    </svg>
                    Copy
                `
        copyButton.style.background = 'var(--bg-tertiary)'
        copyButton.style.color = 'var(--text-secondary)'
      }, 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  })

  copyButton.addEventListener('mouseenter', () => {
    copyButton.style.background = 'var(--bg-card)'
    copyButton.style.borderColor = 'var(--accent-primary)'
    copyButton.style.color = 'var(--text-primary)'
  })

  copyButton.addEventListener('mouseleave', () => {
    if (!copyButton.textContent.includes('Copied')) {
      copyButton.style.background = 'var(--bg-tertiary)'
      copyButton.style.borderColor = 'var(--border-color)'
      copyButton.style.color = 'var(--text-secondary)'
    }
  })
}

// Add hover effect to table rows
const tableRows = document.querySelectorAll('.comparison-table tbody tr')
tableRows.forEach((row) => {
  row.addEventListener('mouseenter', () => {
    row.style.transform = 'scale(1.01)'
    row.style.transition = 'transform 0.2s ease'
  })

  row.addEventListener('mouseleave', () => {
    row.style.transform = 'scale(1)'
  })
})

// Parallax effect for hero section
window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset
  const hero = document.querySelector('.hero')
  if (hero && scrolled < window.innerHeight) {
    hero.style.transform = `translateY(${scrolled * 0.5}px)`
    hero.style.opacity = 1 - (scrolled / window.innerHeight) * 0.5
  }
})

console.log('DevTools Landing Page - Ready! 🚀')
