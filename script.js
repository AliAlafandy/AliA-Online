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
            if (currentPage === 'mods.html') loadMods();
            if (currentPage === 'my-mods.html') loadMyMods();
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
            navigateTo('index.html');
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
        if (reqContainer) {
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
        }

        const friendsContainer = document.getElementById('friends-list-container');
        if (friendsContainer) {
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
        }
    } catch (err) {
        console.error("Failed to load friends", err);
    }
}

async function sendFriendRequest() {
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    const targetUser = document.getElementById('friend-search-input')?.value.trim();
    if (!loggedUser || !targetUser) { showNotification("Please enter a username.", "error"); return; }
    try {
        const res = await fetch('https://alia-server.onrender.com/api/friend/request', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: loggedUser, to: targetUser })
        });
        const data = await res.json();
        if (res.ok) {
            showNotification(data.message, "success");
            const input = document.getElementById('friend-search-input');
            if (input) input.value = '';
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
        navigateTo('account.html');
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
        
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerText = `${profileData.username}'s Profile`;
        
        const usernameEl = document.getElementById('profile-view-username');
        if (usernameEl) usernameEl.innerText = profileData.username + (profileData.isAdmin ? ' ⚡' : '');
        
        const flagEl = document.getElementById('profile-view-flag');
        if (flagEl) flagEl.innerText = profileData.country === '❌' ? '' : profileData.country;
        
        const pfp = profileData.profilePic || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23030712"/><circle cx="50" cy="40" r="20" fill="%2300d2ff"/><path d="M20 90 Q50 60 80 90" fill="%2300d2ff"/></svg>';
        const imgEl = document.getElementById('profile-view-img');
        if (imgEl) imgEl.src = pfp;
        
        const adminBadge = document.getElementById('profile-view-admin-badge');
        if (adminBadge) {
            if (profileData.isAdmin) adminBadge.style.display = 'block';
            else adminBadge.style.display = 'none';
        }
        
        const addFriendBtn = document.getElementById('profile-add-friend-btn');
        if (addFriendBtn) {
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
        }
        
        if (usernameEl) usernameEl.dataset.username = username;
        await loadUserModsView(username);
    } catch (err) {
        showNotification("Failed to load profile.", "error");
        console.error(err);
    }
}

async function loadUserModsView(username) {
    const container = document.getElementById('profile-view-mods');
    if (!container) return;
    container.innerHTML = '<p style="color: #666;">Loading mods...</p>';
    
    try {
        const res = await fetch(`https://alia-server.onrender.com/api/user/mods?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        
        if (!res.ok || !data.mods || data.mods.length === 0) {
            container.innerHTML = '<p style="color: #666;">This user has no mods.</p>';
            return;
        }
        
        const loggedUser = localStorage.getItem('alia_logged_in_user');
        container.innerHTML = '';
        
        data.mods.forEach(mod => {
            const isLiked = loggedUser && mod.likedBy && mod.likedBy.includes(loggedUser);
            container.innerHTML += `
                <div style="background: #000; padding: 15px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #0055ff;">
                    <h4 style="margin: 0 0 10px 0; color: #00d2ff;">${mod.name}</h4>
                    <p style="font-size: 13px; margin: 5px 0; color: #aaa;">${mod.description || 'No description'}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <span style="font-size: 12px; color: #00d2ff;">⬇️ ${mod.downloads || 0} | ❤️ ${mod.likes || 0}</span>
                        ${loggedUser ? `<button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${mod.name}')" style="padding: 5px 10px; font-size: 11px;">❤️ ${isLiked ? 'Liked' : 'Like'}</button>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = '<p style="color: #ff4444;">Failed to load mods.</p>';
        console.error(err);
    }
}

function sendFriendRequestToProfile() {
    const usernameEl = document.getElementById('profile-view-username');
    if (usernameEl && usernameEl.dataset.username) {
        navigateTo('friends.html');
    }
}

function closeProfileView() {
    navigateTo('mods.html');
}

function switchView(view) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (forgotForm) forgotForm.classList.add('hidden');
    
    if (view === 'register' && registerForm) registerForm.classList.remove('hidden');
    else if (view === 'forgot' && forgotForm) forgotForm.classList.remove('hidden');
    else if (loginForm) loginForm.classList.remove('hidden');
}

async function handleOAuthSuccess(data) {
    if (data.needsUsernameSetup) {
        let chosenUsername = prompt("Choose your custom username:", data.suggestedUsername);
        if (!chosenUsername || chosenUsername.trim() === "") chosenUsername = data.suggestedUsername;
        const setRes = await fetch('https://alia-server.onrender.com/api/auth/set-username', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.email, username: chosenUsername.trim() })
        });
        const setData = await setRes.json();
        if (setRes.ok) {
            localStorage.setItem('alia_logged_in_user', setData.username);
            showNotification(`Welcome, ${setData.username}!`, "success");
            checkAuth(); 
            navigateTo('index.html');
        } else { showNotification(setData.error || "Failed to set username.", "error"); }
    } else {
        localStorage.setItem('alia_logged_in_user', data.username);
        showNotification(`Welcome back, ${data.username}!`, "success");
        checkAuth(); 
        navigateTo('index.html');
    }
}

async function handleGoogleSignIn(response) {
    if (!navigator.onLine) return;
    try {
        const res = await fetch('https://alia-server.onrender.com/api/auth/google', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });
        const data = await res.json();
        if (res.ok) handleOAuthSuccess(data);
        else showNotification(data.error || "Google authentication failed.", "error");
    } catch (err) { showNotification("Network error during Google sign in.", "error"); }
}

function handleDiscordSignIn() {
    if (!navigator.onLine) return;
    sessionStorage.setItem('oauth_provider', 'discord');
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=1541971598008000613&redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}&response_type=code&scope=identify%20email`;
}

function handleGitHubSignIn() {
    if (!navigator.onLine) return;
    sessionStorage.setItem('oauth_provider', 'github');
    window.location.href = `https://github.com/login/oauth/authorize?client_id=Ov23li6a0G1oxaCwPtGk&redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}&scope=user:email`;
}

async function checkOAuthCallbacks() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const provider = sessionStorage.getItem('oauth_provider');
    const iss = urlParams.get('iss');
    if (!code) return;
    
    window.history.replaceState({}, document.title, window.location.pathname);
    sessionStorage.removeItem('oauth_provider');

    const isGitHub = (provider === 'github' || (iss && iss.includes('github')));
    const endpoint = isGitHub ? 'https://alia-server.onrender.com/api/auth/github' : 'https://alia-server.onrender.com/api/auth/discord';
    const providerName = isGitHub ? 'GitHub' : 'Discord';
    
    try {
        const res = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, redirectUri: window.location.origin + window.location.pathname })
        });
        const data = await res.json();
        if (res.ok) handleOAuthSuccess(data);
        else showNotification(data.error || `${providerName} authentication failed.`, "error");
    } catch (err) { showNotification(`Network error during ${providerName} sign in.`, "error"); }
}

async function handleRegister() {
    if (!navigator.onLine) return;
    let user = document.getElementById('reg-username')?.value.trim();
    const pass = document.getElementById('reg-password')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim();
    
    if (!user || !pass || !email) { showNotification("Please fill in username, password, and email.", "error"); return; }
    
    try {
        let response = await fetch(`https://alia-server.onrender.com/api/check-username?username=${encodeURIComponent(user)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.exists) { user = user + "1"; showNotification(`Username taken! Auto-set to: ${user}`, "info"); }
        }
        const regResponse = await fetch('https://alia-server.onrender.com/api/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass, email: email, phone: phone })
        });
        const regData = await regResponse.json();
        if (regResponse.ok) {
            localStorage.setItem('alia_logged_in_user', user);
            showNotification(`Account created successfully! Welcome, ${user}.`, "success");
            checkAuth(); navigateTo('index.html');
        } else { showNotification(regData.error || "Registration failed.", "error"); }
    } catch (err) { showNotification("Network error during registration.", "error"); }
}

async function handleLogin() {
    if (!navigator.onLine) return;
    const identifier = document.getElementById('login-identifier')?.value.trim();
    const pass = document.getElementById('login-password')?.value.trim();
    if (!identifier || !pass) { showNotification("Please fill in both fields.", "error"); return; }
    
    try {
        const response = await fetch('https://alia-server.onrender.com/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: identifier, password: pass })
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('alia_logged_in_user', data.username || identifier);
            showNotification(`Welcome back, ${data.username || identifier}!`, "success");
            checkAuth(); navigateTo('index.html');
        } else { showNotification(data.error || "Invalid credentials.", "error"); }
    } catch (err) { showNotification("Network error during login.", "error"); }
}

async function handleForgotPassword() {
    if (!navigator.onLine) return;
    const user = document.getElementById('forgot-username')?.value.trim();
    const email = document.getElementById('forgot-email')?.value.trim();
    if (!user || !email) { showNotification("Please enter both username and recovery email.", "error"); return; }
    
    try {
        const response = await fetch('https://alia-server.onrender.com/api/forgot-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email })
        });
        const data = await response.json();
        if (response.ok) { showNotification("Password reset instructions sent to your email.", "success"); switchView('login'); }
        else { showNotification(data.error || "Could not process password reset.", "error"); }
    } catch (err) { showNotification("Network error during password reset.", "error"); }
}

function logout() {
    localStorage.removeItem('alia_logged_in_user');
    showNotification("Logged out successfully.", "info");
    checkAuth(); navigateTo('index.html');
}

function previewProfilePic(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const accountImg = document.getElementById('account-profile-img');
            const headerImg = document.getElementById('header-profile-img');
            if (accountImg) accountImg.src = e.target.result;
            if (headerImg) headerImg.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function handleUpdateAccount() {
    if (!navigator.onLine) return;
    const oldUser = localStorage.getItem('alia_logged_in_user');
    let newUser = document.getElementById('update-username')?.value.trim();
    const newEmail = document.getElementById('update-email')?.value.trim();
    const newPhone = document.getElementById('update-phone')?.value.trim();
    const newPass = document.getElementById('update-password')?.value.trim();
    const country = document.getElementById('country-select')?.value;
    const profilePicInput = document.getElementById('update-profile-pic');

    if (!oldUser) { showNotification("You must be logged in.", "error"); return; }
    if (!newUser) { showNotification("Username cannot be empty.", "error"); return; }

    const formData = new FormData();
    formData.append('oldUsername', oldUser);
    formData.append('newUsername', newUser);
    formData.append('newEmail', newEmail);
    formData.append('newPhone', newPhone);
    formData.append('newPassword', newPass);
    formData.append('country', country);
    if (profilePicInput && profilePicInput.files.length > 0) formData.append('profilePic', profilePicInput.files[0]);

    try {
        const response = await fetch('https://alia-server.onrender.com/api/update-account', { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('alia_logged_in_user', newUser);
            const profileData = { country: country, email: newEmail, phone: newPhone };
            if (profilePicInput && profilePicInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profileData.profilePic = e.target.result;
                    localStorage.setItem('alia_user_profile_' + newUser, JSON.stringify(profileData));
                    checkAuth();
                };
                reader.readAsDataURL(profilePicInput.files[0]);
            } else {
                localStorage.setItem('alia_user_profile_' + newUser, JSON.stringify(profileData));
                checkAuth();
            }
            showNotification("Account updated successfully!", "success");
        } else { showNotification(data.error || "Update failed.", "error"); }
    } catch (err) { showNotification("Network error updating account.", "error"); }
}

async function uploadModToServer() {
    if (!navigator.onLine) return;
    const user = localStorage.getItem('alia_logged_in_user');
    const modName = document.getElementById('mod-name')?.value.trim();
    const modDesc = document.getElementById('mod-desc')?.value.trim();
    const modTag = document.getElementById('mod-tag')?.value;
    const modColor = document.getElementById('mod-color')?.value;
    const fileInput = document.getElementById('mod-file');
    const iconInput = document.getElementById('mod-icon-file');
    
    if (!modName || !fileInput || fileInput.files.length === 0) { showNotification("Please provide a mod name and select a .zip file.", "error"); return; }
    
    const formData = new FormData();
    formData.append('username', user); formData.append('modName', modName); formData.append('modDesc', modDesc);
    formData.append('modTag', modTag); formData.append('modColor', modColor); formData.append('modFile', fileInput.files[0]);
    if (iconInput && iconInput.files.length > 0) formData.append('iconFile', iconInput.files[0]);
    
    try {
        showNotification("Uploading mod to server...", "info");
        const response = await fetch('https://alia-server.onrender.com/api/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok) {
            showNotification("Success! Your mod is uploaded.", "success");
            if (document.getElementById('mod-name')) document.getElementById('mod-name').value = '';
            if (document.getElementById('mod-desc')) document.getElementById('mod-desc').value = '';
            if (document.getElementById('mod-color')) document.getElementById('mod-color').value = '#0088ff';
            if (fileInput) fileInput.value = '';
            if (iconInput) iconInput.value = '';
            navigateTo('mods.html');
        } else { showNotification(data.error || "Upload failed.", "error"); }
    } catch (err) { showNotification("Upload failed. Check console.", "error"); }
}

function loadMods() {
    if (!navigator.onLine) return;
    fetch('https://alia-server.onrender.com/api/mods?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => { allMods = data.mods || []; applyFilters(); })
        .catch(() => {
            const container = document.getElementById('mods-container');
            if (container) container.innerText = "Failed to load mods.";
        });
}

function filterByTag(tag, event) {
    currentTag = tag;
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    applyFilters();
}

function applyFilters() {
    const query = document.getElementById('search-input')?.value.toLowerCase() || '';
    let filtered = allMods.filter(mod => 
        (mod.name && mod.name.toLowerCase().includes(query)) ||
        (mod.uploader && mod.uploader.toLowerCase().includes(query)) ||
        (mod.description && mod.description.toLowerCase().includes(query)) ||
        (mod.download_url && mod.download_url.toLowerCase().includes(query))
    );
    if (currentTag !== 'All') {
        filtered = filtered.filter(mod => mod.tag === currentTag || (mod.tags && mod.tags.includes(currentTag)));
    }
    displayMods(filtered, 'mods-container');
}

function displayMods(modsArray, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!modsArray || modsArray.length === 0) { container.innerHTML = "No mods found."; return; }

    const loggedUser = localStorage.getItem('alia_logged_in_user');
    const now = new Date().getTime();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    modsArray.forEach(mod => {
        const isFavorited = loggedUser && mod.favoritedBy && mod.favoritedBy.includes(loggedUser);
        const isLiked = loggedUser && mod.likedBy && mod.likedBy.includes(loggedUser);
        const isFollowing = loggedUser && mod.followers && mod.followers.includes(loggedUser);
        
        let showUpdateTag = false;
        if (mod.updated_at && (now - mod.updated_at < twoDaysMs)) showUpdateTag = true;

        const canDelete = loggedUser && (loggedUser === 'Ethantobot11' || loggedUser === 'Ali Alafandy' || (mod.download_url && mod.download_url.includes(`/uploads/${loggedUser}/`)));

        const flag = mod.uploaderCountry === '❌' ? '' : (mod.uploaderCountry || '🌍');
        const pfp = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23030712"/><circle cx="50" cy="40" r="20" fill="%2300d2ff"/><path d="M20 90 Q50 60 80 90" fill="%2300d2ff"/></svg>';

        container.innerHTML += `
            <div class="mod-card" style="border-color: ${mod.color || '#0088ff'}; box-shadow: 0 0 12px ${mod.color ? mod.color + '4D' : 'rgba(0, 136, 255, 0.3)'}">
                ${loggedUser ? `<button class="favorite-btn ${isFavorited ? 'favorited' : ''}" onclick="toggleFavorite('${mod.name}')" title="Favorite">⭐</button>` : ''}
                ${showUpdateTag ? '<div class="update-tag">UPDATE</div>' : ''}
                ${canDelete ? `<button class="delete-btn" onclick="confirmDeleteMod('${mod.name}')" title="Delete Mod">🗑️</button>` : ''}
                <img src="${mod.icon || 'images/default-icon.png'}" alt="${mod.name}" class="mod-icon">
                <h3>${mod.name}</h3>
                <div style="display:flex; align-items:center; justify-content:center; gap:5px; margin-bottom:8px;">
                    <span style="font-size:16px;">${flag}</span>
                    <span style="font-size:12px; color:#00d2ff; cursor: pointer; text-decoration: underline;" onclick="navigateTo('profile.html?user=${encodeURIComponent(mod.uploader)}')">${mod.uploader || 'Unknown'}</span>
                </div>
                <p style="font-size: 13px;">${mod.description || ''}</p>
                <div class="mod-stats">
                    <span>📦 ${mod.size || 'N/A'}</span>
                    <span>⬇️ ${mod.downloads || 0}</span>
                    <span>❤️ ${mod.likes || 0}</span>
                </div>
                <div class="action-btns">
                    ${loggedUser ? `<button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${mod.name}')">❤️ Like</button>` : ''}
                    ${loggedUser ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" onclick="toggleFollow('${mod.name}')">🔔 ${isFollowing ? 'Following' : 'Follow'}</button>` : ''}
                </div>
                <button class="download-btn" onclick="downloadMod('${mod.name}', '${mod.download_url}')" style="border-color: ${mod.color || '#00d2ff'}; color: ${mod.color || '#00d2ff'}; width: 100%; margin-top: 10px;">Download Mod</button>
            </div>
        `;
    });
}

function downloadMod(modName, url) {
    fetch('https://alia-server.onrender.com/api/increment-download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modName: modName })
    }).catch(err => console.error(err));
    window.open(url, '_blank');
    const mod = allMods.find(m => m.name === modName);
    if (mod) { mod.downloads = (mod.downloads || 0) + 1; applyFilters(); }
}

async function toggleFavorite(modName) {
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    if (!loggedUser) { showNotification("Please login to favorite mods.", "error"); return; }
    try {
        const res = await fetch('https://alia-server.onrender.com/api/toggle-favorite', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: loggedUser, modName: modName })
        });
        const data = await res.json();
        if (res.ok) {
            const mod = allMods.find(m => m.name === modName);
            if (mod) {
                if (!mod.favoritedBy) mod.favoritedBy = [];
                if (data.favorited) { if (!mod.favoritedBy.includes(loggedUser)) mod.favoritedBy.push(loggedUser); } 
                else { mod.favoritedBy = mod.favoritedBy.filter(u => u !== loggedUser); }
                mod.favorites = data.favorites;
            }
            showNotification(data.favorited ? "Added to favorites!" : "Removed from favorites.", "success");
            if (currentPage === 'mods.html') applyFilters();
            else if (currentPage === 'favorites.html') loadFavorites();
        } else { showNotification(data.error || "Failed to update favorite.", "error"); }
    } catch (err) { showNotification("Network error.", "error"); }
}

async function toggleLike(modName) {
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    if (!loggedUser) { showNotification("Please login to like mods.", "error"); return; }
    try {
        const res = await fetch('https://alia-server.onrender.com/api/toggle-like', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: loggedUser, modName: modName })
        });
        const data = await res.json();
        if (res.ok) {
            const mod = allMods.find(m => m.name === modName);
            if (mod) {
                if (!mod.likedBy) mod.likedBy = [];
                if (data.liked) { if (!mod.likedBy.includes(loggedUser)) mod.likedBy.push(loggedUser); } 
                else { mod.likedBy = mod.likedBy.filter(u => u !== loggedUser); }
                mod.likes = data.likes;
            }
            showNotification(data.liked ? "Mod liked! ❤️" : "Like removed.", "success");
            if (currentPage === 'mods.html') applyFilters();
        } else { showNotification(data.error || "Failed to update like.", "error"); }
    } catch (err) { showNotification("Network error.", "error"); }
}

async function toggleFollow(modName) {
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    if (!loggedUser) { showNotification("Please login to follow mods.", "error"); return; }
    try {
        const res = await fetch('https://alia-server.onrender.com/api/toggle-follow', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: loggedUser, modName: modName })
        });
        const data = await res.json();
        if (res.ok) {
            const mod = allMods.find(m => m.name === modName);
            if (mod) {
                if (!mod.followers) mod.followers = [];
                if (data.following) { if (!mod.followers.includes(loggedUser)) mod.followers.push(loggedUser); } 
                else { mod.followers = mod.followers.filter(u => u !== loggedUser); }
            }
            showNotification(data.following ? "You will now get update notifications for this mod! 🔔" : "Unfollowed mod.", "success");
            if (currentPage === 'mods.html') applyFilters();
        } else { showNotification(data.error || "Failed to update follow.", "error"); }
    } catch (err) { showNotification("Network error.", "error"); }
}

function loadFavorites() {
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    const container = document.getElementById('favorites-container');
    if (!container) return;
    if (!loggedUser) { container.innerHTML = "Please login to view your favorite mods."; return; }
    const favMods = allMods.filter(mod => mod.favoritedBy && mod.favoritedBy.includes(loggedUser));
    displayMods(favMods, 'favorites-container');
    if (favMods.length === 0) container.innerHTML = "You haven't favorited any mods yet.";
}

function loadMyMods() {
    if (!navigator.onLine) return;
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    const container = document.getElementById('my-mods-container');
    if (!container) return;
    if (!loggedUser) { container.innerHTML = "Please login to view your uploaded mods."; return; }
    fetch('https://alia-server.onrender.com/api/mods?t=' + new Date().getTime())
        .then(res => res.json())
        .then(data => {
            const mods = data.mods || [];
            const isMod = (loggedUser === 'Ethantobot11' || loggedUser === 'Ali Alafandy');
            const userMods = mods.filter(mod => isMod || (mod.download_url && mod.download_url.includes(`/uploads/${loggedUser}/`)));
            container.innerHTML = '';
            if (userMods.length === 0) { container.innerHTML = "You haven't uploaded any mods yet."; return; }
            displayMods(userMods, 'my-mods-container');
        }).catch(() => container.innerText = "Error loading your mods.");
}

async function loadUserModsForDropdown() {
    if (!navigator.onLine) return;
    const loggedUser = localStorage.getItem('alia_logged_in_user');
    const select = document.getElementById('update-mod-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Your Mod --</option>';
    if (!loggedUser) return;
    try {
        const res = await fetch('https://alia-server.onrender.com/api/mods');
        const data = await res.json();
        const mods = data.mods || [];
        const isMod = (loggedUser === 'Ethantobot11' || loggedUser === 'Ali Alafandy');
        const userMods = mods.filter(mod => isMod || (mod.download_url && mod.download_url.includes(`/uploads/${loggedUser}/`)));
        userMods.forEach(mod => { select.innerHTML += `<option value="${mod.name}">${mod.name}</option>`; });
    } catch (err) { console.error("Could not load user mods for dropdown"); }
}

async function updateExistingMod() {
    if (!navigator.onLine) return;
    const user = localStorage.getItem('alia_logged_in_user');
    const modName = document.getElementById('update-mod-select')?.value;
    const fileInput = document.getElementById('update-mod-file');
    if (!modName || !fileInput || fileInput.files.length === 0) { showNotification("Please select a mod and choose a new .zip file.", "error"); return; }
    const formData = new FormData();
    formData.append('username', user); formData.append('modName', modName); formData.append('modFile', fileInput.files[0]);
    try {
        showNotification("Uploading updated mod file...", "info");
        const response = await fetch('https://alia-server.onrender.com/api/update-mod-file', { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok) { showNotification("Success! Your mod has been updated.", "success"); fileInput.value = ''; navigateTo('mods.html'); }
        else { showNotification(data.error || "Update failed.", "error"); }
    } catch (err) { showNotification("Update failed. Check console.", "error"); }
}