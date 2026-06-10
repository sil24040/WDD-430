const authPanel = document.getElementById('auth-panel');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showLogin = document.getElementById('show-login');
const showRegister = document.getElementById('show-register');
const appPanel = document.getElementById('app-panel');
const roomsList = document.getElementById('rooms-list');
const roomCount = document.getElementById('room-count');
const createRoomForm = document.getElementById('create-room-form');
const landlordPanel = document.getElementById('landlord-panel');
const renterPanel = document.getElementById('renter-panel');
const messagesList = document.getElementById('messages-list');
const landlordPaymentsList = document.getElementById('landlord-payments-list');
const renterPaymentsList = document.getElementById('renter-payments-list');
const landlordMaintenanceList = document.getElementById('landlord-maintenance-list');
const renterMaintenanceList = document.getElementById('renter-maintenance-list');
const maintenanceForm = document.getElementById('maintenance-form');
const maintenanceRoomSelect = document.getElementById('maintenance-room-select');
const renterPayRentList = document.getElementById('renter-pay-rent-list');
const tabPayRentButton = document.getElementById('tab-pay-rent');
const tabMaintenanceButton = document.getElementById('tab-maintenance');
const payRentTab = document.getElementById('pay-rent-tab');
const maintenanceTab = document.getElementById('maintenance-tab');
const profileForm = document.getElementById('profile-form');
const inquiriesList = document.getElementById('inquiries-list');
const logoutButton = document.getElementById('logout-button');
const userLabel = document.getElementById('user-label');
const statusBanner = document.getElementById('status-banner');
const roomSearchInput = document.getElementById('room-search');
const roomAvailabilityFilter = document.getElementById('room-filter');

let currentUser = null;
let allRooms = [];
let payments = [];
let maintenanceRequests = [];

function showStatus(message, type = 'success') {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner status-${type}`;
  statusBanner.hidden = false;
  window.setTimeout(() => {
    statusBanner.hidden = true;
  }, 4000);
}

function toggleAuthForm(showLoginForm) {
  loginForm.classList.toggle('hidden', !showLoginForm);
  registerForm.classList.toggle('hidden', showLoginForm);
  showLogin.classList.toggle('active', showLoginForm);
  showRegister.classList.toggle('active', !showLoginForm);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Request failed');
  }
  return body;
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function renderRoomCard(room) {
  const ownerLabel = room.ownerName ? `Owner: ${room.ownerName}` : 'Owner: Unknown';
  const availability = room.available ? 'Available' : 'Unavailable';
  const isOwner = currentUser && currentUser.id === room.ownerId;

  const paySection = currentUser && currentUser.role === 'renter' && !isOwner && room.available
    ? `
      <div class="room-form-actions">
        <button data-room-id="${room.id}" class="primary-button pay-rent-button">Pay rent</button>
      </div>
    `
    : '';

  const contactSection = currentUser && currentUser.role === 'renter' && !isOwner
    ? `
      <div class="room-form-row">
        <textarea placeholder="Send a message to the landlord" data-room-id="${room.id}" class="contact-message"></textarea>
        <div class="room-form-actions">
          <button data-room-id="${room.id}" class="primary-button contact-button">Contact landlord</button>
        </div>
      </div>
    `
    : '';

  const ownerControls = isOwner
    ? `
      <div class="room-form-actions">
        <button data-room-id="${room.id}" class="secondary-button edit-room-button">Edit listing</button>
        <button data-room-id="${room.id}" class="secondary-button danger-button delete-room-button">Delete listing</button>
      </div>
      <details class="room-details">
        <summary>Edit listing details</summary>
        <form data-room-id="${room.id}" class="edit-room-form">
          <div class="form-grid">
            <label>
              Title
              <input name="title" value="${room.title}" />
            </label>
            <label>
              Description
              <textarea name="description">${room.description}</textarea>
            </label>
            <label>
              Location
              <input name="location" value="${room.location}" />
            </label>
            <label>
              Price
              <input type="number" name="price" min="0" value="${room.price}" />
            </label>
            <label>
              Available
              <select name="available">
                <option value="true" ${room.available ? 'selected' : ''}>Yes</option>
                <option value="false" ${!room.available ? 'selected' : ''}>No</option>
              </select>
            </label>
            <button type="submit" class="primary-button">Save changes</button>
          </div>
        </form>
      </details>
    `
    : '';

  return `
    <div class="room-card" data-room-id="${room.id}">
      <h3>${room.title}</h3>
      <p>${room.description}</p>
      <div class="room-meta">
        <span>${ownerLabel}</span>
        <span>${room.location}</span>
        <span>${formatPrice(room.price)}</span>
        <span class="badge">${availability}</span>
      </div>
      <div class="room-form-actions">
        <button data-room-id="${room.id}" class="secondary-button details-toggle-button">View details</button>
      </div>
      <div id="room-details-${room.id}" class="room-detail-panel hidden">
        <p><strong>Status:</strong> ${availability}</p>
        <p><strong>Location:</strong> ${room.location}</p>
        <p><strong>Price:</strong> ${formatPrice(room.price)}</p>
        <p><strong>Owner:</strong> ${ownerLabel.replace('Owner: ', '')}</p>
      </div>
      ${paySection}
      ${contactSection}
      ${ownerControls}
    </div>
  `;
}

function renderMessages(messages) {
  if (!messages.length) {
    return '<p>No messages yet. Renters will see your rooms and can contact you here.</p>';
  }

  return messages.map((message) => `
    <article class="message-card">
      <h3>${message.senderName} sent a message</h3>
      <div class="message-meta">
        <span>${message.roomTitle}</span>
        <span>${new Date(message.createdAt).toLocaleString()}</span>
      </div>
      <p>${message.message}</p>
    </article>
  `).join('');
}

function renderInquiries(inquiries) {
  if (!inquiries.length) {
    return '<p>No inquiries submitted yet. Use the contact box on a listing to send a message.</p>';
  }

  return inquiries.map((inquiry) => `
    <article class="message-card">
      <h3>Contacted ${inquiry.landlordName}</h3>
      <div class="message-meta">
        <span>${inquiry.roomTitle}</span>
        <span>${new Date(inquiry.createdAt).toLocaleString()}</span>
      </div>
      <p>${inquiry.message}</p>
    </article>
  `).join('');
}

function renderPayments(items) {
  if (!items.length) {
    return '<p>No payments have been recorded yet.</p>';
  }

  return items.map((payment) => `
    <article class="message-card">
      <h3>${payment.status === 'paid' ? 'Rent paid' : 'Payment recorded'}</h3>
      <div class="message-meta">
        <span>${payment.roomTitle}</span>
        <span>${new Date(payment.createdAt).toLocaleString()}</span>
      </div>
      <p>${formatPrice(payment.amount)}</p>
      ${payment.renterName ? `<small>Renter: ${payment.renterName}</small>` : ''}
    </article>
  `).join('');
}

function renderMaintenanceRequests(requests) {
  if (!requests.length) {
    return '<p>No maintenance requests yet.</p>';
  }

  return requests.map((request) => {
    const isLandlord = currentUser && currentUser.role === 'landlord';
    return `
      <article class="message-card">
        <h3>${request.roomTitle}</h3>
        <div class="message-meta">
          <span>Status: ${request.status}</span>
          <span>${new Date(request.createdAt).toLocaleString()}</span>
        </div>
        <p>${request.description}</p>
        ${isLandlord ? `<small>Submitted by: ${request.requesterName}</small>` : ''}
        ${request.response ? `<p><strong>Response:</strong> ${request.response}</p>` : ''}
        ${isLandlord ? `
          <details class="room-details">
            <summary>Update request</summary>
            <form data-request-id="${request.id}" class="maintenance-update-form">
              <div class="form-grid">
                <label>
                  Status
                  <select name="status">
                    <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="in progress" ${request.status === 'in progress' ? 'selected' : ''}>In progress</option>
                    <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option>
                  </select>
                </label>
                <label>
                  Response
                  <textarea name="response" rows="3">${request.response || ''}</textarea>
                </label>
                <button type="submit" class="primary-button">Save update</button>
              </div>
            </form>
          </details>
        ` : ''}
      </article>
    `;
  }).join('');
}

function renderRentPayOptions(rooms) {
  if (!rooms.length) {
    return '<p>No available rooms to pay rent for right now.</p>';
  }

  return rooms.map((room) => `
    <article class="message-card">
      <h3>${room.title}</h3>
      <div class="room-meta">
        <span>${room.location}</span>
        <span>${formatPrice(room.price)}</span>
      </div>
      <p>${room.description}</p>
      <div class="room-form-actions">
        <button data-room-id="${room.id}" class="primary-button pay-rent-button">Pay rent</button>
      </div>
    </article>
  `).join('');
}

function showRenterTab(tabName) {
  const isPayTab = tabName === 'pay';
  payRentTab.classList.toggle('hidden', !isPayTab);
  maintenanceTab.classList.toggle('hidden', isPayTab);
  tabPayRentButton.classList.toggle('active', isPayTab);
  tabMaintenanceButton.classList.toggle('active', !isPayTab);
}

function populateMaintenanceRooms() {
  if (!maintenanceRoomSelect || !currentUser) return;

  const availableRooms = allRooms.filter((room) => room.available && room.ownerId !== currentUser.id);
  maintenanceRoomSelect.innerHTML = availableRooms.length
    ? availableRooms.map((room) => `<option value="${room.id}">${room.title} — ${room.location}</option>`).join('')
    : '<option value="">No active listings available</option>';
}

function renderRooms() {
  const query = roomSearchInput.value.trim().toLowerCase();
  const availability = roomAvailabilityFilter.value;

  const filteredRooms = allRooms.filter((room) => {
    const text = `${room.title} ${room.description} ${room.location}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesAvailability = availability === 'all'
      || (availability === 'available' && room.available)
      || (availability === 'unavailable' && !room.available);
    return matchesQuery && matchesAvailability;
  });

  roomsList.innerHTML = filteredRooms.length
    ? filteredRooms.map(renderRoomCard).join('')
    : '<p>No rooms match your search.</p>';
  roomCount.textContent = `${filteredRooms.length} rooms`;
  addRoomListeners();
}

async function loadRooms() {
  const data = await apiFetch('/api/rooms');
  allRooms = data.rooms;
  renderRooms();
  populateMaintenanceRooms();

  if (currentUser && currentUser.role === 'renter') {
    const payableRooms = allRooms.filter((room) => room.available && room.ownerId !== currentUser.id);
    renterPayRentList.innerHTML = renderRentPayOptions(payableRooms);
    addPayRentListeners();
  }
}

async function loadMessages() {
  if (!currentUser || currentUser.role !== 'landlord') return;
  const data = await apiFetch('/api/messages');
  messagesList.innerHTML = renderMessages(data.messages);
}

async function loadPayments() {
  if (!currentUser) return;
  const data = await apiFetch('/api/payments');
  payments = data.payments;
  if (currentUser.role === 'landlord') {
    landlordPaymentsList.innerHTML = renderPayments(payments);
  } else {
    renterPaymentsList.innerHTML = renderPayments(payments);
  }
}

async function loadMaintenanceRequests() {
  if (!currentUser) return;
  const data = await apiFetch('/api/maintenance');
  maintenanceRequests = data.maintenanceRequests;
  if (currentUser.role === 'landlord') {
    landlordMaintenanceList.innerHTML = renderMaintenanceRequests(maintenanceRequests);
  } else {
    renterMaintenanceList.innerHTML = renderMaintenanceRequests(maintenanceRequests);
  }
}

async function loadProfile() {
  if (!currentUser) return;
  const data = await apiFetch('/api/profile');
  fillProfileForm(data.user);
}

async function loadInquiries() {
  if (!currentUser || currentUser.role !== 'renter') return;
  const data = await apiFetch('/api/inquiries');
  inquiriesList.innerHTML = renderInquiries(data.inquiries);
}

function fillProfileForm(user) {
  profileForm.querySelector('[name="name"]').value = user.name || '';
  profileForm.querySelector('[name="email"]').value = user.email || '';
  profileForm.querySelector('[name="role"]').value = user.role || '';
  profileForm.querySelector('[name="preferredLocation"]').value = user.preferredLocation || '';
  profileForm.querySelector('[name="preferredBudget"]').value = user.preferredBudget || '';
}

function showApp() {
  authPanel.hidden = true;
  authPanel.classList.add('hidden');
  appPanel.hidden = false;
  appPanel.classList.remove('hidden');
  logoutButton.hidden = false;
  userLabel.textContent = `${currentUser.name} (${currentUser.role})`;
  landlordPanel.hidden = currentUser.role !== 'landlord';
  landlordPanel.classList.toggle('hidden', currentUser.role !== 'landlord');
  renterPanel.hidden = currentUser.role !== 'renter';
  renterPanel.classList.toggle('hidden', currentUser.role !== 'renter');

  if (currentUser.role === 'renter') {
    showRenterTab('pay');
  }
}

function showAuth() {
  authPanel.hidden = false;
  authPanel.classList.remove('hidden');
  appPanel.hidden = true;
  appPanel.classList.add('hidden');
  logoutButton.hidden = true;
  userLabel.textContent = '';
}

async function refreshApp() {
  try {
    const sessionData = await apiFetch('/api/session');
    currentUser = sessionData.user;
    if (currentUser) {
      showApp();
      await Promise.all([loadRooms(), loadProfile(), loadMessages(), loadInquiries(), loadPayments(), loadMaintenanceRequests()]);
    } else {
      showAuth();
      await loadRooms();
    }
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

function addRoomListeners() {
  roomsList.querySelectorAll('.contact-button').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const roomId = event.target.dataset.roomId;
      const textarea = roomsList.querySelector(`textarea.contact-message[data-room-id="${roomId}"]`);
      if (!textarea || !textarea.value.trim()) {
        showStatus('Enter a message before contacting the landlord.', 'error');
        return;
      }
      try {
        await apiFetch('/api/contact', {
          method: 'POST',
          body: { roomId, message: textarea.value.trim() }
        });
        textarea.value = '';
        showStatus('Message sent successfully.');
        await loadInquiries();
      } catch (error) {
        showStatus(error.message, 'error');
      }
    });
  });

  roomsList.querySelectorAll('.pay-rent-button').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const roomId = event.target.dataset.roomId;
      try {
        await apiFetch('/api/payments', {
          method: 'POST',
          body: { roomId }
        });
        showStatus('Rent payment completed successfully.');
        await loadPayments();
      } catch (error) {
        showStatus(error.message, 'error');
      }
    });
  });

  roomsList.querySelectorAll('.delete-room-button').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const roomId = event.target.dataset.roomId;
      if (!confirm('Delete this room listing?')) return;
      try {
        await apiFetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
        showStatus('Room deleted successfully.');
        await refreshApp();
      } catch (error) {
        showStatus(error.message, 'error');
      }
    });
  });

  roomsList.querySelectorAll('.details-toggle-button').forEach((button) => {
    button.addEventListener('click', (event) => {
      const roomId = event.target.dataset.roomId;
      const details = document.getElementById(`room-details-${roomId}`);
      if (details) {
        details.classList.toggle('hidden');
      }
    });
  });

  roomsList.querySelectorAll('.edit-room-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const roomId = form.dataset.roomId;
      const formData = new FormData(form);
      const body = {
        title: formData.get('title'),
        description: formData.get('description'),
        location: formData.get('location'),
        price: Number(formData.get('price')),
        available: formData.get('available') === 'true'
      };

      try {
        await apiFetch(`/api/rooms/${roomId}`, { method: 'PUT', body });
        showStatus('Room updated successfully.');
        await refreshApp();
      } catch (error) {
        showStatus(error.message, 'error');
      }
    });
  });
}

function addPayRentListeners() {
  renterPayRentList.querySelectorAll('.pay-rent-button').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const roomId = event.target.dataset.roomId;
      try {
        await apiFetch('/api/payments', {
          method: 'POST',
          body: { roomId }
        });
        showStatus('Rent payment completed successfully.');
        await loadRooms();
        await loadPayments();
      } catch (error) {
        showStatus(error.message, 'error');
      }
    });
  });
}

document.querySelectorAll('.maintenance-update-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const requestId = form.dataset.requestId;
    const formData = new FormData(form);
    const body = {
      status: formData.get('status'),
      response: formData.get('response')
    };

    try {
      await apiFetch(`/api/maintenance/${requestId}`, { method: 'PUT', body });
      showStatus('Maintenance request updated.');
      await loadMaintenanceRequests();
    } catch (error) {
      showStatus(error.message, 'error');
    }
  });
});

showLogin.addEventListener('click', () => toggleAuthForm(true));
showRegister.addEventListener('click', () => toggleAuthForm(false));
logoutButton.addEventListener('click', async () => {
  try {
    await apiFetch('/api/logout', { method: 'POST' });
    currentUser = null;
    showStatus('Logged out successfully.');
    showAuth();
    await loadRooms();
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

tabPayRentButton.addEventListener('click', () => showRenterTab('pay'));
tabMaintenanceButton.addEventListener('click', () => showRenterTab('maintenance'));

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: { email: formData.get('email'), password: formData.get('password') }
    });
    currentUser = data.user;
    showStatus('Logged in successfully.');
    await refreshApp();
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  try {
    const data = await apiFetch('/api/register', {
      method: 'POST',
      body: {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role')
      }
    });
    currentUser = data.user;
    showStatus('Registration complete.');
    await refreshApp();
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

createRoomForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(createRoomForm);
  try {
    await apiFetch('/api/rooms', {
      method: 'POST',
      body: {
        title: formData.get('title'),
        description: formData.get('description'),
        location: formData.get('location'),
        price: formData.get('price')
      }
    });
    createRoomForm.reset();
    showStatus('Room created successfully.');
    await refreshApp();
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

maintenanceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(maintenanceForm);
  try {
    await apiFetch('/api/maintenance', {
      method: 'POST',
      body: {
        roomId: formData.get('roomId'),
        description: formData.get('description')
      }
    });
    maintenanceForm.reset();
    showStatus('Maintenance request submitted successfully.');
    await loadMaintenanceRequests();
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);

  try {
    const data = await apiFetch('/api/profile', {
      method: 'PUT',
      body: {
        name: formData.get('name'),
        email: formData.get('email'),
        preferredLocation: formData.get('preferredLocation'),
        preferredBudget: formData.get('preferredBudget')
      }
    });
    currentUser = data.user;
    showStatus('Profile updated successfully.');
    await refreshApp();
  } catch (error) {
    showStatus(error.message, 'error');
  }
});

roomSearchInput.addEventListener('input', renderRooms);
roomAvailabilityFilter.addEventListener('change', renderRooms);

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await refreshApp();
  } catch (error) {
    showStatus('Unable to load the app. Please refresh.', 'error');
  }
});
