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

app.post('/api/upload', upload.single('modFile'), async (req, res) => {
    const { username, modName, modDesc } = req.body;
    const file = req.file;

    if (!username || !modName || !file) {
        return res.status(400).json({ error: "Missing required fields or file." });
    }

    try {
        const userModsDir = path.join(__dirname, 'uploads', username, 'mods');
        if (!fs.existsSync(userModsDir)) {
            fs.mkdirSync(userModsDir, { recursive: true });
        }

        const zipFileName = `${modName}.zip`;
        const localFilePath = path.join(userModsDir, zipFileName);
        fs.renameSync(file.path, localFilePath);

        const serverBaseUrl = `${req.protocol}://${req.get('host')}`;
        const downloadUrl = `${serverBaseUrl}/uploads/${username}/mods/${zipFileName}`;

        let modsData = getModsData();
        if (!modsData.mods) modsData.mods = [];

        modsData.mods.push({
            name: modName,
            description: modDesc || "",
            download_url: downloadUrl,
            icon: "images/default-icon.png"
        });

        saveModsData(modsData);

        res.json({ success: true, download_url: downloadUrl });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
