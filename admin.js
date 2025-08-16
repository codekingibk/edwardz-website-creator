class AdminService {
    constructor() {
        this.apiUrl = 'https://your-render-app.onrender.com/api/admin';
    }

    async getUsers() {
        try {
            const token = localStorage.getItem('edwards_token');
            const response = await fetch(`${this.apiUrl}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to fetch users');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    }

    async updateUser(userId, updates) {
        try {
            const token = localStorage.getItem('edwards_token');
            const response = await fetch(`${this.apiUrl}/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to update user');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    async sendBroadcast(message) {
        try {
            const token = localStorage.getItem('edwards_token');
            const response = await fetch(`${this.apiUrl}/broadcast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message })
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to send broadcast');
            }
        } catch (error) {
            console.error('Error sending broadcast:', error);
            throw error;
        }
    }

    async toggleMaintenance(message) {
        try {
            const token = localStorage.getItem('edwards_token');
            const response = await fetch(`${this.apiUrl}/maintenance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message })
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to toggle maintenance mode');
            }
        } catch (error) {
            console.error('Error toggling maintenance:', error);
            throw error;
        }
    }
}

// Admin UI management
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/admin') {
        initAdminPanel();
    }
});

async function initAdminPanel() {
    const authService = new AuthService();
    const adminService = new AdminService();
    
    // Verify admin status
    if (!authService.currentUser || authService.currentUser.role !== 'admin') {
        window.location.href = '/';
        return;
    }

    // Load users
    try {
        const users = await adminService.getUsers();
        renderUsersTable(users);
    } catch (error) {
        alert('Failed to load users: ' + error.message);
    }

    // Set up event listeners
    document.getElementById('broadcastForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = document.getElementById('broadcastMessage').value;
        
        try {
            await adminService.sendBroadcast(message);
            alert('Broadcast sent successfully!');
        } catch (error) {
            alert('Failed to send broadcast: ' + error.message);
        }
    });

    document.getElementById('maintenanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = document.getElementById('maintenanceMessage').value;
        const enable = document.getElementById('enableMaintenance').checked;
        
        try {
            const result = await adminService.toggleMaintenance(enable ? message : '');
            alert(`Maintenance mode ${enable ? 'enabled' : 'disabled'} successfully!`);
        } catch (error) {
            alert('Failed to toggle maintenance mode: ' + error.message);
        }
    });
}

function renderUsersTable(users) {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.userId}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.coins}€</td>
            <td>${user.status || 'active'}</td>
            <td>
                <input type="number" class="coin-input" data-userid="${user.userId}" value="${user.coins}" min="0">
                <button class="btn btn-sm btn-primary update-coins" data-userid="${user.userId}">Update</button>
            </td>
            <td>
                <select class="status-select" data-userid="${user.userId}">
                    <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                    <option value="banned" ${user.status === 'banned' ? 'selected' : ''}>Banned</option>
                </select>
                <button class="btn btn-sm btn-secondary update-status" data-userid="${user.userId}">Update</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Add event listeners for update buttons
    document.querySelectorAll('.update-coins').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.getAttribute('data-userid');
            const coins = this.previousElementSibling.value;
            
            try {
                await adminService.updateUser(userId, { coins: parseInt(coins) });
                alert('Coins updated successfully!');
                const users = await adminService.getUsers();
                renderUsersTable(users);
            } catch (error) {
                alert('Failed to update coins: ' + error.message);
            }
        });
    });
    
    document.querySelectorAll('.update-status').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.getAttribute('data-userid');
            const status = this.previousElementSibling.value;
            
            try {
                await adminService.updateUser(userId, { status });
                alert('Status updated successfully!');
                const users = await adminService.getUsers();
                renderUsersTable(users);
            } catch (error) {
                alert('Failed to update status: ' + error.message);
            }
        });
    });
}
