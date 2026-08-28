require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

const USERS_FILE = path.join(__dirname, 'users.json');
const MODS_FILE = path.join(__dirname, 'mods.json');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { return []; }
}
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getModsData() {
    if (!fs.existsSync(MODS_FILE)) return { mods: [] };
    try { return JSON.parse(fs.readFileSync(MODS_FILE, 'utf8')); } catch (e) { return { mods: [] }; }
}
function saveModsData(data) {
    fs.writeFileSync(MODS_FILE, JSON.stringify(data, null, 2));
}

const upload = multer({ dest: path.join(__dirname, 'temp_uploads') });

app.get('/api/check-username', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username required." });
    const users = getUsers();
    const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    return res.json({ exists });
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });
    let users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: "Username already taken." });
    }
    users.push({ username, password });
    saveUsers(users);
    return res.status(200).json({ success: true, message: "Registered successfully." });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(400).json({ error: "Invalid username or password." });
    return res.status(200).json({ success: true, message: "Login successful." });
});

app.post('/api/update-account', (req, res) => {
    const { oldUsername, newUsername, newPassword } = req.body;
    if (!oldUsername || !newUsername) {
        return res.status(400).json({ error: "Old and new usernames are required." });
    }
    let users = getUsers();
    const userIndex = users.findIndex(u => u.username === oldUsername);
    if (userIndex === -1) {
        return res.status(404).json({ error: "User not found." });
    }
    if (newUsername !== oldUsername && users.find(u => u.username.toLowerCase() === newUsername.toLowerCase())) {
        return res.status(400).json({ error: "Username already taken." });
    }
    users[userIndex].username = newUsername;
    if (newPassword && newPassword.trim() !== "") {
        users[userIndex].password = newPassword;
    }
    saveUsers(users);
    return res.json({ success: true, message: "Account updated successfully." });
});

app.get('/api/mods', (req, res) => {
    const modsData = getModsData();
    res.json(modsData);
});

app.post('/api/upload', upload.any(), async (req, res) => {
    const { username, modName, modDesc } = req.body;
    const files = req.files;

    if (!username || !modName || !files || files.length === 0) {
        return res.status(400).json({ error: "Missing required fields or files." });
    }

    try {
        const userModsDir = path.join(__dirname, 'uploads', username, 'mods');
        if (!fs.existsSync(userModsDir)) {
            fs.mkdirSync(userModsDir, { recursive: true });
        }

        const serverBaseUrl = `${req.protocol}://${req.get('host')}`;
        let downloadUrl = "";
        let iconUrl = "images/default-icon.png";

        files.forEach(file => {
            if (file.fieldname === 'modFile' || file.originalname.endsWith('.zip')) {
                const zipFileName = `${modName}.zip`;
                fs.copyFileSync(file.path, path.join(userModsDir, zipFileName));
                fs.unlinkSync(file.path);
                downloadUrl = `${serverBaseUrl}/uploads/${username}/mods/${zipFileName}`;
            } else if (file.fieldname === 'iconFile' || file.mimetype.startsWith('image/')) {
                const iconExt = path.extname(file.originalname) || '.png';
                const iconFileName = `${modName}_icon${iconExt}`;
                fs.copyFileSync(file.path, path.join(userModsDir, iconFileName));
                fs.unlinkSync(file.path);
                iconUrl = `${serverBaseUrl}/uploads/${username}/mods/${iconFileName}`;
            }
        });

        if (!downloadUrl) {
            return res.status(400).json({ error: "Missing required .zip mod file." });
        }

        let modsData = getModsData();
        if (!modsData.mods) modsData.mods = [];

        const existingIndex = modsData.mods.findIndex(m => m.name === modName);
        const now = new Date().getTime();

        const newModObj = {
            name: modName,
            description: modDesc || "",
            download_url: downloadUrl,
            icon: iconUrl,
            updated_at: now
        };

        if (existingIndex !== -1) {
            modsData.mods[existingIndex] = newModObj;
        } else {
            modsData.mods.push(newModObj);
        }

        saveModsData(modsData);
        res.json({ success: true, download_url: downloadUrl, icon_url: iconUrl });

    } catch (err) {
        console.error("UPLOAD CRASH:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-mod-file', upload.single('modFile'), async (req, res) => {
    const { username, modName } = req.body;
    const file = req.file;

    if (!username || !modName || !file) {
        return res.status(400).json({ error: "Missing required fields or file." });
    }

    let modsData = getModsData();
    if (!modsData.mods) modsData.mods = [];

    const modIndex = modsData.mods.findIndex(m => m.name === modName);
    if (modIndex === -1) {
        return res.status(404).json({ error: "Mod not found." });
    }

    const mod = modsData.mods[modIndex];
    const isMod = (username === 'Ethantobot11' || username === 'Ali Alafandy');
    const isOwner = mod.download_url && mod.download_url.includes(`/uploads/${username}/`);

    if (!isMod && !isOwner) {
        return res.status(403).json({ error: "Unauthorized to update this mod." });
    }

    const match = mod.download_url.match(/\/uploads\/([^/]+)\/mods\//);
    const ownerName = match ? match[1] : username;

    try {
        const userModsDir = path.join(__dirname, 'uploads', ownerName, 'mods');
        if (!fs.existsSync(userModsDir)) {
            fs.mkdirSync(userModsDir, { recursive: true });
        }

        const zipFileName = `${modName}.zip`;
        const targetPath = path.join(userModsDir, zipFileName);
        fs.copyFileSync(file.path, targetPath);
        fs.unlinkSync(file.path);

        modsData.mods[modIndex].updated_at = new Date().getTime();
        saveModsData(modsData);

        return res.json({ success: true, message: "Mod file updated successfully." });
    } catch (err) {
        console.error("UPDATE MOD FILE ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete-mod', (req, res) => {
    const { username, modName } = req.body;
    if (!username || !modName) {
        return res.status(400).json({ error: "Username and mod name are required." });
    }

    let modsData = getModsData();
    if (!modsData.mods) modsData.mods = [];

    const isMod = (username === 'Ethantobot11' || username === 'Ali Alafandy');
    const modIndex = modsData.mods.findIndex(m => m.name === modName && (isMod || m.download_url.includes(`/uploads/${username}/`)));
    
    if (modIndex === -1) {
        return res.status(404).json({ error: "Mod not found or unauthorized." });
    }

    const mod = modsData.mods[modIndex];
    const match = mod.download_url.match(/\/uploads\/([^/]+)\/mods\//);
    const ownerName = match ? match[1] : username;

    try {
        const userModsDir = path.join(__dirname, 'uploads', ownerName, 'mods');
        if (fs.existsSync(userModsDir)) {
            const files = fs.readdirSync(userModsDir);
            files.forEach(file => {
                if (file.startsWith(modName)) {
                    const filePath = path.join(userModsDir, file);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            });
        }
    } catch (err) {
        console.error("Error deleting files from disk:", err);
    }

    modsData.mods.splice(modIndex, 1);
    saveModsData(modsData);

    return res.json({ success: true, message: "Mod deleted successfully." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
