class AuthService {
    constructor() {
        this.currentUser = null;
        this.apiUrl = 'https://your-render-app.onrender.com/api';
        this.checkAuthState();
    }

    async checkAuthState() {
        const token = localStorage.getItem('edwards_token');
        if (token) {
            try {
                const response = await fetch(`${this.apiUrl}/auth/verify`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const user = await response.json();
                    this.currentUser = user;
                    this.updateUI();
                    return true;
                }
            } catch (error) {
                console.error('Auth verification failed:', error);
            }
        }
        this.updateUI();
        return false;
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('edwards_token', data.token);
                this.currentUser = data.user;
                this.updateUI();
                showNotification('Login successful!', 'success');
                return true;
            } else {
                const error = await response.json();
                showNotification(error.message || 'Login failed', 'error');
                return false;
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Network error. Please try again.', 'error');
            return false;
        }
    }

    async register(username, email, password) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            if (response.ok) {
                const data = await response.json();
                showNotification('Registration successful! Please login.', 'success');
                return true;
            } else {
                const error = await response.json();
                showNotification(error.message || 'Registration failed', 'error');
                return false;
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification('Network error. Please try again.', 'error');
            return false;
        }
    }

    logout() {
        localStorage.removeItem('edwards_token');
        this.currentUser = null;
        this.updateUI();
        showNotification('Logged out successfully', 'success');
    }

    updateUI() {
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        const adminPanel = document.getElementById('adminPanelLink');
        
        if (this.currentUser) {
            authButtons.style.display = 'none';
            userInfo.style.display = 'flex';
            document.querySelector('.username').textContent = this.currentUser.username;
            document.getElementById('coinBalance').textContent = this.currentUser.coins || 0;
            
            if (this.currentUser.role === 'admin') {
                adminPanel.style.display = 'block';
            } else {
                adminPanel.style.display = 'none';
            }
        } else {
            authButtons.style.display = 'flex';
            userInfo.style.display = 'none';
            adminPanel.style.display = 'none';
        }
    }

    async deductCoins(amount) {
        if (!this.currentUser) return false;
        
        try {
            const token = localStorage.getItem('edwards_token');
            const response = await fetch(`${this.apiUrl}/user/deduct-coins`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser.coins = data.newBalance;
                this.updateUI();
                return true;
            } else {
                const error = await response.json();
                showNotification(error.message || 'Failed to deduct coins', 'error');
                return false;
            }
        } catch (error) {
            console.error('Coin deduction error:', error);
            showNotification('Network error. Please try again.', 'error');
            return false;
        }
    }
}

// Initialize auth service
const authService = new AuthService();

// Event listeners for auth modals
document.getElementById('loginBtn').addEventListener('click', () => {
    document.getElementById('loginModal').style.display = 'block';
});

document.getElementById('registerBtn').addEventListener('click', () => {
    document.getElementById('registerModal').style.display = 'block';
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    authService.logout();
});

// Close modals when clicking X
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
    });
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    const success = await authService.login(username, password);
    if (success) {
        document.getElementById('loginModal').style.display = 'none';
    }
});

// Register form submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    const success = await authService.register(username, email, password);
    if (success) {
        document.getElementById('registerModal').style.display = 'none';
    }
});

// Helper function to show notifications
function showNotification(message, type) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                         type === 'error' ? 'exclamation-circle' : 
                         type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}
