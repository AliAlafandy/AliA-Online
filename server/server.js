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

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });
    let users = getUsers();
    if (users.find(u => u.username === username)) return res.status(400).json({ error: "Username already taken." });
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

app.get('/api/mods', (req, res) => {
    const modsData = getModsData();
    res.json(modsData);
});

app.post('/api/upload', upload.fields([
    { name: 'modFile', maxCount: 1 },
    { name: 'iconFile', maxCount: 1 }
]), async (req, res) => {
    const { username, modName, modDesc } = req.body;
    const files = req.files;

    if (!username || !modName || !files || !files.modFile) {
        return res.status(400).json({ error: "Missing required fields or mod file." });
    }

    try {
        const userModsDir = path.join(__dirname, 'uploads', username, 'mods');
        if (!fs.existsSync(userModsDir)) {
            fs.mkdirSync(userModsDir, { recursive: true });
        }

        const serverBaseUrl = `${req.protocol}://${req.get('host')}`;

        const modFile = files.modFile[0];
        const zipFileName = `${modName}.zip`;
        const localZipPath = path.join(userModsDir, zipFileName);
        fs.renameSync(modFile.path, localZipPath);
        const downloadUrl = `${serverBaseUrl}/uploads/${username}/mods/${zipFileName}`;

        let iconUrl = "images/default-icon.png";
        if (files.iconFile && files.iconFile.length > 0) {
            const iconFile = files.iconFile[0];
            const iconExt = path.extname(iconFile.originalname) || '.png';
            const iconFileName = `${modName}_icon${iconExt}`;
            const localIconPath = path.join(userModsDir, iconFileName);
            fs.renameSync(iconFile.path, localIconPath);
            iconUrl = `${serverBaseUrl}/uploads/${username}/mods/${iconFileName}`;
        }

        let modsData = getModsData();
        if (!modsData.mods) modsData.mods = [];

        modsData.mods.push({
            name: modName,
            description: modDesc || "",
            download_url: downloadUrl,
            icon: iconUrl
        });

        saveModsData(modsData);

        res.json({ success: true, download_url: downloadUrl, icon_url: iconUrl });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
