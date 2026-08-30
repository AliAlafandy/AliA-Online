require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const BUCKET_NAME = 'mods-bucket';

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, default: "" },
    email: { type: String, default: "" }
});
const User = mongoose.model('User', userSchema);

const modSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    download_url: { type: String, required: true },
    icon: { type: String, default: "images/default-icon.png" },
    updated_at: { type: Number, required: true }
});
const Mod = mongoose.model('Mod', modSchema);

const upload = multer({ dest: path.join(__dirname, 'temp_uploads') });

app.get('/api/check-username', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username required." });
    try {
        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        return res.json({ exists: !!user });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });
    try {
        const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
            return res.status(400).json({ error: "Username already taken." });
        }
        await User.create({ username, password });
        return res.status(200).json({ success: true, message: "Registered successfully." });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/set-username', async (req, res) => {
    const { email, username } = req.body;
    if (!email || !username) {
        return res.status(400).json({ error: "Email and username are required." });
    }

    try {
        const taken = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (taken) {
            return res.status(400).json({ error: "Username is already taken." });
        }

        let user = await User.findOne({ email });
        if (user) {
            user.username = username;
            await user.save();
        } else {
            user = await User.create({ username, email, password: "" });
        }

        return res.json({ success: true, username: user.username });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });
    try {
        const user = await User.findOne({ 
            username: { $regex: new RegExp(`^${username}$`, 'i') }, 
            password 
        });
        if (!user) return res.status(400).json({ error: "Invalid username or password." });
        return res.status(200).json({ success: true, message: "Login successful.", username: user.username });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-account', async (req, res) => {
    const { oldUsername, newUsername, newPassword } = req.body;
    if (!oldUsername || !newUsername) {
        return res.status(400).json({ error: "Old and new usernames are required." });
    }
    try {
        const user = await User.findOne({ username: oldUsername });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        if (newUsername !== oldUsername) {
            const taken = await User.findOne({ username: { $regex: new RegExp(`^${newUsername}$`, 'i') } });
            if (taken) return res.status(400).json({ error: "Username already taken." });
        }
        user.username = newUsername;
        if (newPassword && newPassword.trim() !== "") {
            user.password = newPassword;
        }
        await user.save();
        return res.json({ success: true, message: "Account updated successfully." });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/mods', async (req, res) => {
    try {
        const mods = await Mod.find({});
        res.json({ mods });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload', upload.any(), async (req, res) => {
    const { username, modName, modDesc } = req.body;
    const files = req.files;

    if (!username || !modName || !files || files.length === 0) {
        return res.status(400).json({ error: "Missing required fields or files." });
    }

    try {
        let downloadUrl = "";
        let iconUrl = "images/default-icon.png";

        for (const file of files) {
            const fileBuffer = fs.readFileSync(file.path);

            if (file.fieldname === 'modFile' || file.originalname.endsWith('.zip')) {
                const filePath = `${username}/${modName}.zip`;
                const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, fileBuffer, {
                    contentType: 'application/zip',
                    upsert: true
                });
                if (error) throw error;

                const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
                downloadUrl = data.publicUrl;
            } else if (file.fieldname === 'iconFile' || file.mimetype.startsWith('image/')) {
                const iconExt = path.extname(file.originalname) || '.png';
                const filePath = `${username}/${modName}_icon${iconExt}`;
                const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, fileBuffer, {
                    contentType: file.mimetype,
                    upsert: true
                });
                if (error) throw error;

                const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
                iconUrl = data.publicUrl;
            }

            fs.unlinkSync(file.path);
        }

        if (!downloadUrl) {
            return res.status(400).json({ error: "Missing required .zip mod file." });
        }

        const now = new Date().getTime();
        await Mod.findOneAndUpdate(
            { name: modName },
            {
                name: modName,
                description: modDesc || "",
                download_url: downloadUrl,
                icon: iconUrl,
                updated_at: now
            },
            { upsert: true, new: true }
        );

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

    try {
        const mod = await Mod.findOne({ name: modName });
        if (!mod) {
            return res.status(404).json({ error: "Mod not found." });
        }

        const isMod = (username === 'Ethantobot11' || username === 'Ali Alafandy');
        const isOwner = mod.download_url && mod.download_url.includes(`/${username}/`);

        if (!isMod && !isOwner) {
            return res.status(403).json({ error: "Unauthorized to update this mod." });
        }

        const match = mod.download_url.match(/\/storage\/v1\/object\/public\/[^/]+\/([^/]+)\//);
        const ownerName = match ? match[1] : username;

        const fileBuffer = fs.readFileSync(file.path);
        const filePath = `${ownerName}/${modName}.zip`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, fileBuffer, {
            contentType: 'application/zip',
            upsert: true
        });
        fs.unlinkSync(file.path);

        if (error) throw error;

        mod.updated_at = new Date().getTime();
        await mod.save();

        return res.json({ success: true, message: "Mod file updated successfully." });
    } catch (err) {
        console.error("UPDATE MOD FILE ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete-mod', async (req, res) => {
    const { username, modName } = req.body;
    if (!username || !modName) {
        return res.status(400).json({ error: "Username and mod name are required." });
    }

    try {
        const isMod = (username === 'Ethantobot11' || username === 'Ali Alafandy');
        const mod = await Mod.findOne({ name: modName });
        
        if (!mod || (!isMod && !mod.download_url.includes(`/${username}/`))) {
            return res.status(404).json({ error: "Mod not found or unauthorized." });
        }

        const match = mod.download_url.match(/\/storage\/v1\/object\/public\/[^/]+\/([^/]+)\//);
        const ownerName = match ? match[1] : username;

        await supabase.storage.from(BUCKET_NAME).remove([
            `${ownerName}/${modName}.zip`,
            `${ownerName}/${modName}_icon.png`,
            `${ownerName}/${modName}_icon.jpg`,
            `${ownerName}/${modName}_icon.jpeg`
        ]);

        await Mod.deleteOne({ name: modName });
        return res.json({ success: true, message: "Mod deleted successfully." });
    } catch (err) {
        console.error("Error deleting mod:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Google token required." });

    try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const googleUser = await googleRes.json();

        if (!googleRes.ok || !googleUser.email) {
            return res.status(400).json({ error: "Invalid Google token." });
        }

        const email = googleUser.email;
        const baseUsername = googleUser.name || email.split('@')[0];
        
        let user = await User.findOne({ $or: [{ email }, { username: { $regex: new RegExp(`^${baseUsername}$`, 'i') } }] });
        
        if (!user) {
            return res.json({ 
                needsUsernameSetup: true, 
                email: email, 
                suggestedUsername: baseUsername 
            });
        }

        return res.json({ success: true, username: user.username });
    } catch (err) {
        console.error("Google Auth Error:", err);
        return res.status(500).json({ error: "Google authentication failed." });
    }
});

app.post('/api/auth/discord', async (req, res) => {
    const { code, redirectUri } = req.body;
    if (!code) return res.status(400).json({ error: "Discord auth code required." });

    const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

    try {
        const tokenParams = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
        });

        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: tokenParams,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
            return res.status(400).json({ error: "Failed to exchange Discord code." });
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json();

        if (!userRes.ok) {
            return res.status(400).json({ error: "Failed to fetch Discord user profile." });
        }

        const email = discordUser.email;
        const baseUsername = discordUser.username;

        let user = await User.findOne({ $or: [{ email: email || "" }, { username: { $regex: new RegExp(`^${baseUsername}$`, 'i') } }] });

        if (!user) {
            return res.json({ 
                needsUsernameSetup: true, 
                email: email || `${discordUser.id}@discord.placeholder`, 
                suggestedUsername: baseUsername 
            });
        }

        return res.json({ success: true, username: user.username });
    } catch (err) {
        console.error("Discord Auth Error:", err);
        return res.status(500).json({ error: "Discord authentication failed." });
    }
});

app.post('/api/auth/github', async (req, res) => {
    const { code, redirectUri } = req.body;
    if (!code) return res.status(400).json({ error: "GitHub auth code required." });

    const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

    try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code: code, redirect_uri: redirectUri })
        });
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || tokenData.error) {
            return res.status(400).json({ error: tokenData.error_description || "Failed to exchange GitHub code." });
        }
        
        const userRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': 'Ali-A-App' },
        });
        const githubUser = await userRes.json();

        if (!userRes.ok) {
            return res.status(400).json({ error: "Failed to fetch GitHub user profile." });
        }

        let email = githubUser.email;
        if (!email) {
            const emailRes = await fetch('https://api.github.com/user/emails', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': 'Ali-A-App' },
            });
            if (emailRes.ok) {
                const emails = await emailRes.json();
                const primaryEmailObj = emails.find(e => e.primary && e.verified);
                if (primaryEmailObj) email = primaryEmailObj.email;
            }
        }

        const baseUsername = githubUser.login || githubUser.name || "GitHubUser";
        let user = await User.findOne({ $or: [{ email: email || "" }, { username: { $regex: new RegExp(`^${baseUsername}$`, 'i') } }] });

        if (!user) {
            return res.json({ 
                needsUsernameSetup: true, 
                email: email || `${githubUser.id}@github.placeholder`, 
                suggestedUsername: baseUsername 
            });
        }

        return res.json({ success: true, username: user.username });
    } catch (err) {
        console.error("GitHub Auth Error:", err);
        return res.status(500).json({ error: "GitHub authentication failed." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
