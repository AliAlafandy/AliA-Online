require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.REPO_OWNER;
const REPO = process.env.REPO_NAME;

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/api/upload-mod', async (req, res) => {
    const { username, modName, modDesc, modFileBase64, iconPath } = req.body;

    if (!username || !modName || !modFileBase64) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        const userModsDir = path.join(__dirname, 'uploads', username, 'mods');
        if (!fs.existsSync(userModsDir)) {
            fs.mkdirSync(userModsDir, { recursive: true });
        }

        const zipFileName = `${modName}.zip`;
        const localFilePath = path.join(userModsDir, zipFileName);
        const buffer = Buffer.from(modFileBase64, 'base64');
        fs.writeFileSync(localFilePath, buffer);

        const serverBaseUrl = `${req.protocol}://${req.get('host')}`;
        const downloadUrl = `${serverBaseUrl}/uploads/${username}/mods/${zipFileName}`;

        const jsonResponse = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/mods.json`, {
            headers: { 
                'Authorization': `Bearer ${TOKEN}`,
                'User-Agent': 'AliA-Mod-Server'
            }
        });
        const jsonData = await jsonResponse.json();
        const sha = jsonData.sha;
        
        let decodedContent = JSON.parse(Buffer.from(jsonData.content, 'base64').toString('utf8'));
        
        decodedContent.mods.push({
            name: modName,
            description: modDesc || "",
            download_url: downloadUrl,
            icon: iconPath || "images/default-icon.png"
        });

        const updateRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/mods.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'AliA-Mod-Server'
            },
            body: JSON.stringify({
                message: `Auto-update mods.json with server-hosted mod: ${modName}`,
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
