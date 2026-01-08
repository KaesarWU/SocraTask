// SocraTask Login Page JavaScript - Enhanced Interactions
document.addEventListener('DOMContentLoaded', function() {
    // Form submission handler
    const loginForm = document.querySelector('.login-form');
    const loginButton = document.querySelector('.login-button');
    
    if (loginForm && loginButton) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form values
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Show loading state
            showLoadingState(loginButton);
            
            // Simulate authentication process
            setTimeout(() => {
                hideLoadingState(loginButton);
                
                // Here you would normally make an API call
                // For demo purposes, we'll just show a success message
                showMessage('Welcome to SocraTask! Redirecting...', 'success');
                
                // Redirect after successful login (simulated)
                setTimeout(() => {
                    // window.location.href = '/dashboard'; // Uncomment in production
                    console.log('Login successful - redirecting to dashboard');
                }, 2000);
            }, 2000);
        });
    }

    // Social login handlers
    const socialButtons = document.querySelectorAll('.social-login');
    socialButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const provider = this.classList.contains('google') ? 'Google' : 'GitHub';
            
            showMessage(`Redirecting to ${provider} authentication...`, 'info');
            
            // Simulate social login process
            setTimeout(() => {
                showMessage(`${provider} authentication initiated successfully!`, 'success');
            }, 1500);
        });
    });

    // Signup link handler
    const signupLink = document.querySelector('.signup-link');
    if (signupLink) {
        signupLink.addEventListener('click', function(e) {
            e.preventDefault();
            showMessage('Account creation coming soon! Stay tuned.', 'info');
        });
    }

    // Forgot password handler
    const forgotPassword = document.querySelector('.forgot-password');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', function(e) {
            e.preventDefault();
            showMessage('Password recovery functionality coming soon!', 'info');
        });
    }

    // Input field interactions
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
        
        input.addEventListener('input', function() {
            // Add validation feedback
            validateInput(this);
        });
    });

    // Create floating labels effect
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.querySelector('label').style.transform = 'translateY(-25px)';
        });
        
        input.addEventListener('blur', function() {
            if (this.value === '') {
                this.parentElement.querySelector('label').style.transform = 'translateY(0)';
            }
        });
    });

    // Add hover effects to glass cards
    const glassCards = document.querySelectorAll('.glass-card, .feature-card');
    glassCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Create ripple effect on buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            createRippleEffect(e, this);
        });
    });

    // Initialize particles for background
    initParticles();
});

// Show loading state on button
function showLoadingState(button) {
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `
        <div class="spinner"></div>
        <span>Authenticating...</span>
    `;
    
    // Store original HTML for later restoration
    button.dataset.originalHTML = originalHTML;
}

// Hide loading state on button
function hideLoadingState(button) {
    button.disabled = false;
    button.innerHTML = button.dataset.originalHTML || button.innerHTML;
}

// Show message function
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast ${type}`;
    messageDiv.textContent = message;
    
    // Add styling
    Object.assign(messageDiv.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '1000',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(10px)',
        animation: 'slideIn 0.3s ease-out'
    });
    
    // Set background based on type
    switch(type) {
        case 'success':
            messageDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.9)';
            break;
        case 'error':
            messageDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
            break;
        case 'warning':
            messageDiv.style.backgroundColor = 'rgba(245, 158, 11, 0.9)';
            break;
        default:
            messageDiv.style.backgroundColor = 'rgba(99, 102, 241, 0.9)';
    }
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 4000);
}

// Validate input fields
function validateInput(input) {
    const value = input.value;
    const fieldName = input.id;
    
    // Remove previous validation classes
    input.classList.remove('valid', 'invalid');
    
    if (fieldName === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(value)) {
            input.classList.add('invalid');
        } else if (value) {
            input.classList.add('valid');
        }
    } else if (fieldName === 'password') {
        if (value && value.length < 6) {
            input.classList.add('invalid');
        } else if (value) {
            input.classList.add('valid');
        }
    }
}

// Create ripple effect for buttons
function createRippleEffect(e, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    Object.assign(ripple.style, {
        width: size + 'px',
        height: size + 'px',
        left: x + 'px',
        top: y + 'px',
        position: 'absolute',
        background: 'rgba(255, 255, 255, 0.3)',
        borderRadius: '50%',
        transform: 'scale(0)',
        animation: 'ripple 0.6s linear',
        pointerEvents: 'none',
        border: 'none'
    });
    
    // Add ripple animation keyframes if not exists
    if (!document.querySelector('#ripple-animation')) {
        const style = document.createElement('style');
        style.id = 'ripple-animation';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add ripple to element
    const rippleContainer = element.cloneNode(true);
    rippleContainer.innerHTML = element.innerHTML;
    rippleContainer.appendChild(ripple);
    rippleContainer.style.position = 'relative';
    rippleContainer.style.overflow = 'hidden';
    rippleContainer.style.borderRadius = getComputedStyle(element).borderRadius;
    
    // Replace element temporarily to add ripple
    element.parentNode.replaceChild(rippleContainer, element);
    
    // Restore original element after animation
    setTimeout(() => {
        rippleContainer.parentNode.replaceChild(element, rippleContainer);
    }, 600);
}

// Initialize particle background
function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Particle class
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.5 + 0.1;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
            if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
        }
        
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    function initParticles() {
        particles = [];
        const particleCount = Math.min(50, Math.floor((canvas.width * canvas.height) / 10000));
        
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            
            // Connect nearby particles
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - distance/100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    initParticles();
    animate();
}

// Add CSS for animations that weren't in the main CSS
function addAdditionalCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .input-group label {
            transition: transform 0.2s ease;
        }
        
        .input-group input.valid {
            border-color: rgba(16, 185, 129, 0.5);
        }
        
        .input-group input.invalid {
            border-color: rgba(239, 68, 68, 0.5);
        }
        
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}

// Call the function to add additional CSS
addAdditionalCSS();