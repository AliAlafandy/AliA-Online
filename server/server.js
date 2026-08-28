require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.REPO_OWNER;
const REPO = process.env.REPO_NAME;

const USERS_FILE = path.join(__dirname, 'users.json');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (e) { return []; }
}
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
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

        const jsonResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/mods.json`, {
            headers: { 
                'Authorization': `Bearer ${TOKEN}`,
                'User-Agent': 'AliA-Mod-Server'
            }
        });
        
        if (!jsonResponse.ok) {
            throw new Error("Failed to fetch mods.json from GitHub. Check your repository owner and token.");
        }

        const jsonData = await jsonResponse.json();
        const sha = jsonData.sha;
        
        let decodedContent = JSON.parse(Buffer.from(jsonData.content, 'base64').toString('utf8'));
        
        decodedContent.mods.push({
            name: modName,
            description: modDesc || "",
            download_url: downloadUrl,
            icon: "images/default-icon.png"
        });

        const updateRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/mods.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'AliA-Mod-Server'
            },
            body: JSON.stringify({
                message: `Auto-update mods.json strings for: ${modName}`,
                content: Buffer.from(JSON.stringify(decodedContent, null, 2)).toString('base64'),
                sha: sha
            })
        });

        if (!updateRes.ok) {
            throw new Error("Failed to update mods.json on GitHub.");
        }

        res.json({ success: true, download_url: downloadUrl });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
