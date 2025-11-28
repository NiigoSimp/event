const API_BASE = 'http://localhost:5000/api';

let currentUser = null;
let authToken = null;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    loadHomeStats();
    loadEvents();
    loadCategories();
});

// Navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.add('active');

    // Load specific section data
    if (sectionId === 'profile' && currentUser) {
        loadProfile();
    } else if (sectionId === 'admin' && currentUser && currentUser.role === 'admin') {
        loadAdminStats();
    }
}

// Authentication Functions
async function registerUser(event) {
    event.preventDefault();

    const userData = {
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
        phone: document.getElementById('registerPhone').value
    };

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Registration successful! Please login.', 'success');
            showSection('login');
            event.target.reset();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Registration failed. Please try again.', 'error');
    }
}

async function loginUser(event) {
    event.preventDefault();

    const loginData = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            currentUser = data.data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));

            updateNavigation();
            showMessage('Login successful!', 'success');
            showSection('home');
            event.target.reset();

            // Reload stats and events
            loadHomeStats();
            loadEvents();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('Login failed. Please try again.', 'error');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    updateNavigation();
    showSection('home');
    showMessage('Logged out successfully.', 'success');
}

function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');

    if (token && user) {
        authToken = token;
        currentUser = JSON.parse(user);
        updateNavigation();
    }
}

function updateNavigation() {
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const logoutLink = document.getElementById('logoutLink');
    const adminLink = document.getElementById('adminLink');
    const createEventLink = document.getElementById('createEventLink');
    const profileLink = document.getElementById('profileLink');

    if (currentUser) {
        loginLink.style.display = 'none';
        registerLink.style.display = 'none';
        logoutLink.style.display = 'block';
        profileLink.style.display = 'block';

        if (currentUser.role === 'admin') {
            adminLink.style.display = 'block';
            createEventLink.style.display = 'block';
        } else {
            adminLink.style.display = 'none';
            createEventLink.style.display = 'none';
        }
    } else {
        loginLink.style.display = 'block';
        registerLink.style.display = 'block';
        logoutLink.style.display = 'none';
        adminLink.style.display = 'none';
        createEventLink.style.display = 'none';
        profileLink.style.display = 'none';
    }
}

// EVENT CREATION FUNCTION - THIS WAS MISSING!
async function createEvent(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'admin') {
        showMessage('Only administrators can create events', 'error');
        return;
    }

    // Get form values
    const title = document.getElementById('eventTitle').value;
    const description = document.getElementById('eventDescription').value;
    const category = document.getElementById('eventCategory').value;
    const venue = document.getElementById('eventVenue').value;
    const city = document.getElementById('eventCity').value;
    const country = document.getElementById('eventCountry').value;
    const startDate = document.getElementById('eventStartDate').value;
    const endDate = document.getElementById('eventEndDate').value;
    const organizerName = document.getElementById('organizerName').value;
    const organizerEmail = document.getElementById('organizerEmail').value;
    const organizerPhone = document.getElementById('organizerPhone').value;
    const capacity = document.getElementById('eventCapacity').value;
    const ticketPrice = document.getElementById('eventPrice').value;

    // Validate required fields
    if (!title || !description || !category || !venue || !city || !country ||
        !startDate || !endDate || !organizerName || !organizerEmail || !organizerPhone ||
        !capacity || !ticketPrice) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    // Create event data object
    const eventData = {
        title: title,
        description: description,
        category: category,
        venue: venue,
        city: city,
        country: country,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        organizerName: organizerName,
        organizerEmail: organizerEmail,
        organizerPhone: organizerPhone,
        capacity: parseInt(capacity),
        ticketPrice: parseFloat(ticketPrice)
    };

    console.log('Sending event data:', eventData);

    try {
        const response = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(eventData)
        });

        const data = await response.json();
        console.log('Server response:', data);

        if (data.success) {
            showMessage('Event created successfully!', 'success');
            // Reset form
            event.target.reset();
            // Reload events list
            loadEvents();
            // Show events section
            showSection('events');
        } else {
            showMessage('Error: ' + (data.message || 'Failed to create event'), 'error');
        }
    } catch (error) {
        console.error('Error creating event:', error);
        showMessage('Failed to create event: ' + error.message, 'error');
    }
}

// Event Functions
async function loadEvents() {
    try {
        // Try main events endpoint first
        let response = await fetch(`${API_BASE}/events?limit=50`);
        let data = await response.json();

        // If main endpoint fails, try upcoming events
        if (!data.success) {
            response = await fetch(`${API_BASE}/events/upcoming`);
            data = await response.json();
        }

        if (data.success) {
            displayEvents(data.data);
        } else {
            showMessage('Failed to load events', 'error');
        }
    } catch (error) {
        console.error('Error loading events:', error);
        showMessage('Failed to load events', 'error');
    }
}

function displayEvents(events) {
    const eventsList = document.getElementById('eventsList');

    if (!events || events.length === 0) {
        eventsList.innerHTML = `
            <div class="loading">
                <p>No events found.</p>
                ${currentUser?.role === 'admin' ?
            '<button class="btn-primary" onclick="showSection(\'create-event\')">Create First Event</button>' :
            '<p>Check back later for new events.</p>'
        }
            </div>
        `;
        return;
    }

    eventsList.innerHTML = events.map(event => `
        <div class="event-card">
            <span class="event-category">${event.category}</span>
            <h3>${event.title}</h3>
            <p><strong>Description:</strong> ${event.description}</p>
            <p><strong>Date:</strong> ${new Date(event.dateTime.start).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date(event.dateTime.start).toLocaleTimeString()} - ${new Date(event.dateTime.end).toLocaleTimeString()}</p>
            <p><strong>Location:</strong> ${event.location.venue}, ${event.location.city}</p>
            <p><strong>Price:</strong> $<span class="event-price">${event.ticketPrice}</span></p>
            <p><strong>Capacity:</strong> ${event.capacity} people</p>
            <p><strong>Organizer:</strong> ${event.organizer.name}</p>
            <span class="event-status status-${event.status}">${event.status}</span>
            <div style="margin-top: 1rem;">
                <button class="btn-primary" onclick="viewEventDetails('${event._id}')">View Details</button>
                ${currentUser ? `<button class="btn-secondary" onclick="bookTicket('${event._id}')">Book Ticket</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/events/categories`);
        const data = await response.json();

        if (data.success) {
            const categories = data.data;
            const categoryFilter = document.getElementById('categoryFilter');

            // Update category filter
            categoryFilter.innerHTML = '<option value="">All Categories</option>' +
                categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load categories');
    }
}

function searchEvents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const eventCards = document.querySelectorAll('.event-card');

    eventCards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const description = card.querySelector('p').textContent.toLowerCase();

        if (title.includes(searchTerm) || description.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function filterEvents() {
    const category = document.getElementById('categoryFilter').value;
    const eventCards = document.querySelectorAll('.event-card');

    eventCards.forEach(card => {
        const categoryElement = card.querySelector('.event-category');
        if (categoryElement) {
            const eventCategory = categoryElement.textContent;
            if (category === '' || eventCategory === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// Home Stats
async function loadHomeStats() {
    try {
        const eventsResponse = await fetch(`${API_BASE}/events/upcoming`);
        const eventsData = await eventsResponse.json();

        if (eventsData.success) {
            document.getElementById('totalEvents').textContent = eventsData.count || eventsData.data?.length || 0;
            document.getElementById('upcomingEvents').textContent = eventsData.count || eventsData.data?.length || 0;
        }

        // For user count, you might need to create a separate endpoint
        document.getElementById('totalUsers').textContent = 'N/A';
    } catch (error) {
        console.error('Failed to load stats');
        document.getElementById('totalEvents').textContent = '0';
        document.getElementById('upcomingEvents').textContent = '0';
        document.getElementById('totalUsers').textContent = '0';
    }
}

// Profile Functions
async function loadProfile() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/users/${currentUser.id}/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        if (data.success) {
            displayProfile(data.data);
        }
    } catch (error) {
        showMessage('Failed to load profile', 'error');
    }
}

function displayProfile(profileData) {
    const profileInfo = document.getElementById('profileInfo');
    const user = profileData.user;

    profileInfo.innerHTML = `
        <div class="profile-info">
            <h3>Personal Information</h3>
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Role:</strong> ${user.role}</p>
            ${user.phone ? `<p><strong>Phone:</strong> ${user.phone}</p>` : ''}
            <p><strong>Total Tickets:</strong> ${profileData.ticketStats?.totalTickets || 0}</p>
        </div>
    `;

    loadUserTickets();
}

async function loadUserTickets() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/users/${currentUser.id}/booking-history`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        if (data.success) {
            displayUserTickets(data.data.bookings);
        }
    } catch (error) {
        console.error('Failed to load tickets');
    }
}

function displayUserTickets(tickets) {
    const ticketsList = document.getElementById('ticketsList');

    if (!tickets || tickets.length === 0) {
        ticketsList.innerHTML = '<p>No tickets booked yet.</p>';
        return;
    }

    ticketsList.innerHTML = tickets.map(ticket => `
        <div class="ticket-card">
            <h4>Ticket #${ticket.ticketNumber}</h4>
            <p><strong>Event:</strong> ${ticket.event?.title || 'Event details not available'}</p>
            <p><strong>Quantity:</strong> ${ticket.quantity}</p>
            <p><strong>Total Amount:</strong> $${ticket.totalAmount}</p>
            <p><strong>Status:</strong> ${ticket.paymentStatus}</p>
            <p><strong>Booked:</strong> ${new Date(ticket.bookedAt).toLocaleDateString()}</p>
        </div>
    `).join('');
}

// Admin Functions
async function loadAdminStats() {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        if (data.success) {
            displayAdminStats(data.data);
        }
    } catch (error) {
        showMessage('Failed to load admin stats', 'error');
    }
}

function displayAdminStats(stats) {
    const adminStats = document.getElementById('adminStats');
    const overview = stats.overview;

    adminStats.innerHTML = `
        <div class="stat-card">
            <h3>${overview.totalUsers || 0}</h3>
            <p>Total Users</p>
        </div>
        <div class="stat-card">
            <h3>${overview.totalEvents || 0}</h3>
            <p>Total Events</p>
        </div>
        <div class="stat-card">
            <h3>${overview.totalTickets || 0}</h3>
            <p>Total Tickets</p>
        </div>
        <div class="stat-card">
            <h3>$${overview.totalRevenue || 0}</h3>
            <p>Total Revenue</p>
        </div>
    `;
}

async function loadPaymentSummary() {
    try {
        const response = await fetch(`${API_BASE}/admin/payment-summary/by-event`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        if (data.success) {
            displayPaymentSummary(data.data);
        }
    } catch (error) {
        showMessage('Failed to load payment summary', 'error');
    }
}

function displayPaymentSummary(summary) {
    const adminData = document.getElementById('adminData');

    if (!summary || summary.length === 0) {
        adminData.innerHTML = '<p>No payment data available.</p>';
        return;
    }

    adminData.innerHTML = `
        <h3>Payment Summary by Event</h3>
        ${summary.map(event => `
            <div style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 5px;">
                <h4>${event.eventName}</h4>
                <p>Total Tickets: ${event.totalTickets}</p>
                <p>Total Revenue: $${event.totalAmount}</p>
                <div style="margin-top: 0.5rem;">
                    ${event.paymentStatuses ? event.paymentStatuses.map(status => `
                        <small style="display: inline-block; margin-right: 1rem;">
                            ${status.status}: ${status.tickets} tickets ($${status.amount})
                        </small>
                    `).join('') : 'No payment status data'}
                </div>
            </div>
        `).join('')}
    `;
}

async function loadTopEvents() {
    try {
        const response = await fetch(`${API_BASE}/events/top/registered?limit=5`);
        const data = await response.json();

        if (data.success) {
            displayTopEvents(data.data);
        }
    } catch (error) {
        showMessage('Failed to load top events', 'error');
    }
}

function displayTopEvents(events) {
    const adminData = document.getElementById('adminData');

    if (!events || events.length === 0) {
        adminData.innerHTML = '<p>No event registration data available.</p>';
        return;
    }

    adminData.innerHTML = `
        <h3>Top 5 Most Registered Events</h3>
        ${events.map((event, index) => `
            <div style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 5px;">
                <h4>#${index + 1} - ${event.eventName}</h4>
                <p>Registrations: ${event.totalRegistrations}</p>
            </div>
        `).join('')}
    `;
}

// Utility Functions
function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    // Add to top of container
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Placeholder functions for future implementation
function viewEventDetails(eventId) {
    showMessage('Event details feature coming soon!', 'info');
}

function bookTicket(eventId) {
    showMessage('Ticket booking feature coming soon!', 'info');
}

// Debug function to test the API connection
async function testConnection() {
    try {
        const response = await fetch(`${API_BASE}`);
        const data = await response.json();
        console.log('API Connection test:', data);
        return data;
    } catch (error) {
        console.error('API Connection failed:', error);
        return null;
    }
}

// Test connection on load
window.addEventListener('load', () => {
    testConnection();
});