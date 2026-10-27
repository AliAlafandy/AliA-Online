let allMods = [];
let currentTag = 'All';

const path = window.location.pathname;
const currentPage = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function navigateTo(page) {
    const basePath = path.includes('/AliA-Online/') ? '/AliA-Online/' : '/';
    const cleanPage = page.replace(/^\.+\/|^\//, ''); 
    window.location.href = basePath + cleanPage;
}

async function initPushNotifications() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
        const { PushNotifications } = window.Capacitor.Plugins;
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === 'granted') {
            await PushNotifications.register();
            PushNotifications.addListener('registration', async (token) => {
                const loggedUser = localStorage.getItem('alia_logged_in_user');
                if (loggedUser) {
                    await fetch('https://alia-server.onrender.com/api/save-push-token', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedUser, token: token.value })
                    });
                }
            });
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                showNotification(`${notification.title}: ${notification.body}`, "info");
            });
        }
    }
}

window.onload = function() {
    updateOnlineStatus();
    checkAuth();
    checkOAuthCallbacks();
    initPushNotifications();
    highlightSidebar();

    if (currentPage === 'mods.html') {
        loadMods();
    } else if (currentPage === 'friends.html') {
        loadFriends();
    } else if (currentPage === 'profile.html') {
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('user');
        if (username) fetchUserProfile(username);
    }
};

function highlightSidebar() {
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    if (currentPage === 'index.html' || currentPage === '') document.getElementById('menu-home')?.classList.add('active');
    else if (currentPage === 'mods.html') document.getElementById('menu-mods')?.classList.add('active');
    else if (currentPage === 'friends.html') document.getElementById('menu-friends')?.classList.add('active');
    else if (currentPage === 'upload.html') document.getElementById('menu-upload')?.classList.add('active');
    else if (currentPage === 'account.html') document.getElementById('menu-account')?.classList.add('active');
}

function updateOnlineStatus() {
    const offlineScreen = document.getElementById('offline-screen');
    if (offlineScreen) {
        if (!navigator.onLine) offlineScreen.classList.remove('hidden');
        else offlineScreen.classList.add('hidden');
    }
}

function checkConnection() {
    if (navigator.onLine) { window.location.reload(); } 
    else { showNotification("Still offline. Please check your connection.", "error"); }
}

function toggleSidebar() { 
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('mobile-open'); 
}

function checkAuth() {
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    const uploadMenu = document.getElementById('menu-upload');
    
    if (loggedUser) {
        if (uploadMenu) uploadMenu.classList.remove('hidden');
        const authPanel = document.getElementById('auth-panel');
        if (authPanel) authPanel.classList.add('hidden');
        
        const isAdmin = (loggedUser === 'Ethantobot11' || loggedUser === 'Ali Alafandy');
        const displayName = isAdmin ? loggedUser + ' ⚡' : loggedUser;
        
        const currentUserEl = document.getElementById('current-user');
        if (currentUserEl) currentUserEl.innerText = displayName;
        
        const accountCurrentUserEl = document.getElementById('account-current-user');
        if (accountCurrentUserEl) accountCurrentUserEl.innerText = displayName;
        
        const accountPanel = document.getElementById('account-panel');
        if (accountPanel) accountPanel.classList.remove('hidden');
        
        const userProfile = JSON.parse(localStorage.getItem('alia_user_profile_' + loggedUser) || '{}');
        const countryFlag = userProfile.country === '❌' ? '' : (userProfile.country || '');
        
        const headerFlag = document.getElementById('header-country-flag');
        if (headerFlag) headerFlag.innerText = countryFlag;
        
        const countrySelect = document.getElementById('country-select');
        if (countrySelect) countrySelect.value = userProfile.country || '🌍';
        
        const accountProfileFlag = document.getElementById('account-profile-flag');
        if (accountProfileFlag) accountProfileFlag.innerText = countryFlag;
        
        if (userProfile.profilePic) {
            const headerImg = document.getElementById('header-profile-img');
            if (headerImg) headerImg.src = userProfile.profilePic;
            const accountImg = document.getElementById('account-profile-img');
            if (accountImg) accountImg.src = userProfile.profilePic;
        }
        if (userProfile.email) {
            const emailInput = document.getElementById('update-email');
            if (emailInput) emailInput.value = userProfile.email;
        }
        if (userProfile.phone) {
            const phoneInput = document.getElementById('update-phone');
            if (phoneInput) phoneInput.value = userProfile.phone;
        }
        if (currentPage === 'upload.html') loadUserModsForDropdown();
    } else {
        if (uploadMenu) uploadMenu.classList.add('hidden');
        const authPanel = document.getElementById('auth-panel');
        if (authPanel) authPanel.classList.remove('hidden');
        const accountPanel = document.getElementById('account-panel');
        if (accountPanel) accountPanel.classList.add('hidden');
        const headerFlag = document.getElementById('header-country-flag');
        if (headerFlag) headerFlag.innerText = '';
        const accountProfileFlag = document.getElementById('account-profile-flag');
        if (accountProfileFlag) accountProfileFlag.innerText = '';
    }
}

function confirmDeleteMod(modName) {
            if (confirm(`Are you sure you want to delete the mod "${modName}"?`)) deleteMod(modName);
        }

        async function deleteMod(modName) {
            if (!navigator.onLine) return;
            const loggedUser = localStorage.getItem('alia_logged_in_user');
            try {
                const response = await fetch('https://alia-server.onrender.com/api/delete-mod', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedUser, modName: modName })
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification("Mod deleted successfully!", "success");
                    loadMods();
                    if (!document.getElementById('my-mods-tab').classList.contains('hidden')) loadMyMods();
                } else { showNotification(data.error || "Failed to delete mod.", "error"); }
            } catch (err) { showNotification("Network error while trying to delete mod.", "error"); }
        }

        async function deleteAccount() {
            if (!confirm("WARNING: Are you absolutely sure you want to delete your account? This action cannot be undone!")) return;
            const confirmation = prompt("FINAL WARNING: Type 'DELETE' to confirm account deletion:");
            if (confirmation !== 'DELETE') { showNotification("Account deletion cancelled.", "info"); return; }

            const oldUser = localStorage.getItem('alia_logged_in_user');
            try {
                const response = await fetch('https://alia-server.onrender.com/api/delete-account', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: oldUser })
                });
                const data = await response.json();
                if (response.ok) {
                    showNotification("Account deleted successfully. Logging out...", "success");
                    localStorage.removeItem('alia_logged_in_user');
                    localStorage.removeItem('alia_user_profile_' + oldUser);
                    checkAuth();
                    navigateTo('home-tab');
                } else { showNotification(data.error || "Failed to delete account.", "error"); }
            } catch (err) { showNotification("Network error while trying to delete account.", "error"); }
        }

        async function loadFriends() {
            const loggedUser = localStorage.getItem('alia_logged_in_user');
            if (!loggedUser) return;
            try {
                const res = await fetch(`https://alia-server.onrender.com/api/friends?username=${encodeURIComponent(loggedUser)}`);
                const data = await res.json();
                
                const reqContainer = document.getElementById('friend-requests-container');
                if (data.requests && data.requests.length > 0) {
                    reqContainer.innerHTML = data.requests.map(req => `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #000; padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #0055ff;">
                            <span style="color: #00d2ff; font-weight: bold;">${req.from}</span>
                            <div>
                                <button onclick="acceptFriend('${req.from}')" style="padding: 5px 10px; font-size: 12px; margin-right: 5px; background: #00ff88; color: #000;">Accept</button>
                                <button onclick="rejectFriend('${req.from}')" style="padding: 5px 10px; font-size: 12px; background: #ff4444;">Reject</button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    reqContainer.innerHTML = '<p style="color: #666;">No pending friend requests.</p>';
                }
        
                const friendsContainer = document.getElementById('friends-list-container');
                if (data.friends && data.friends.length > 0) {
                    friendsContainer.innerHTML = data.friends.map(friend => `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #000; padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #00d2ff;">
                            <span style="color: #fff;">${friend}</span>
                            <button onclick="removeFriend('${friend}')" style="padding: 5px 10px; font-size: 12px; background: #ff4444;">Remove</button>
                        </div>
                    `).join('');
                } else {
                    friendsContainer.innerHTML = '<p style="color: #666;">You have no friends yet. Add someone above!</p>';
                }
            } catch (err) {
                console.error("Failed to load friends", err);
            }
        }
        
        async function sendFriendRequest() {
            const loggedUser = localStorage.getItem('alia_logged_in_user');
            const targetUser = document.getElementById('friend-search-input').value.trim();
            if (!loggedUser || !targetUser) { showNotification("Please enter a username.", "error"); return; }
            try {
                const res = await fetch('https://alia-server.onrender.com/api/friend/request', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ from: loggedUser, to: targetUser })
                });
                const data = await res.json();
                if (res.ok) {
                    showNotification(data.message, "success");
                    document.getElementById('friend-search-input').value = '';
                    loadFriends();
                } else {
                    showNotification(data.error, "error");
                }
            } catch (err) { showNotification("Network error.", "error"); }
        }
        
        async function acceptFriend(friendUsername) {
            const loggedUser = localStorage.getItem('alia_logged_in_user');
            try {
                const res = await fetch('https://alia-server.onrender.com/api/friend/accept', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedUser, friendUsername })
                });
                const data = await res.json();
                if (res.ok) { showNotification(data.message, "success"); loadFriends(); }
                else { showNotification(data.error, "error"); }
            } catch (err) { showNotification("Network error.", "error"); }
        }
        
        async function rejectFriend(friendUsername) {
            const loggedUser = localStorage.getItem('alia_logged_in_user');
            try {
                const res = await fetch('https://alia-server.onrender.com/api/friend/reject', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedUser, friendUsername })
                });
                const data = await res.json();
                if (res.ok) { showNotification(data.message, "success"); loadFriends(); }
                else { showNotification(data.error, "error"); }
            } catch (err) { showNotification("Network error.", "error"); }
        }
        
        async function removeFriend(friendUsername) {
            const loggedUser = localStorage.getItem('alia_logged_in_user');
            if (!confirm(`Remove ${friendUsername} from your friends?`)) return;
            try {
                const res = await fetch('https://alia-server.onrender.com/api/friend/remove', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedUser, friendUsername })
                });
                const data = await res.json();
                if (res.ok) { showNotification(data.message, "success"); loadFriends(); }
                else { showNotification(data.error, "error"); }
            } catch (err) { showNotification("Network error.", "error"); }
        }

async function fetchUserProfile(username) {
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    if (!loggedUser) {
        showNotification("Please login to view profiles.", "error");
        navigateTo('utils/account.html');
        return;
    }

    try {
        const profileRes = await fetch(`https://alia-server.onrender.com/api/user/profile?username=${encodeURIComponent(username)}`, {
            headers: { 'x-viewer-username': loggedUser }
        });
        const profileData = await profileRes.json();
        
        if (!profileRes.ok) {
            showNotification(profileData.error || "User not found", "error");
            return;
        }
        
        document.getElementById('page-title').innerText = `${profileData.username}'s Profile`;
        document.getElementById('profile-view-username').innerText = profileData.username + (profileData.isAdmin ? ' ⚡' : '');
        document.getElementById('profile-view-flag').innerText = profileData.country === '❌' ? '' : profileData.country;
        
        const pfp = profileData.profilePic || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23030712"/><circle cx="50" cy="40" r="20" fill="%2300d2ff"/><path d="M20 90 Q50 60 80 90" fill="%2300d2ff"/></svg>';
        document.getElementById('profile-view-img').src = pfp;
        
        const adminBadge = document.getElementById('profile-view-admin-badge');
        if (profileData.isAdmin) adminBadge.style.display = 'block';
        else adminBadge.style.display = 'none';
        
        const addFriendBtn = document.getElementById('profile-add-friend-btn');
        if (username === loggedUser) {
            addFriendBtn.style.display = 'none';
        } else if (profileData.isFriend) {
            addFriendBtn.innerText = 'Already Friends';
            addFriendBtn.disabled = true;
            addFriendBtn.style.background = '#00ff88';
            addFriendBtn.style.color = '#000';
        } else if (profileData.hasPendingRequest) {
            addFriendBtn.innerText = 'Request Sent';
            addFriendBtn.disabled = true;
        } else {
            addFriendBtn.innerText = 'Add Friend';
            addFriendBtn.disabled = false;
            addFriendBtn.style.background = '#0088ff';
            addFriendBtn.style.color = '#fff';
        }
        
        document.getElementById('profile-view-username').dataset.username = username;
        await loadUserModsView(username);
    } catch (err) {
        showNotification("Failed to load profile.", "error");
        console.error(err);
    }
}

function sendFriendRequestToProfile() {
    const username = document.getElementById('profile-view-username').dataset.username;
    if (username) {
        navigateTo('utils/friends.html');
    }
}

function closeProfileView() {
    navigateTo('utils/mods.html');
}