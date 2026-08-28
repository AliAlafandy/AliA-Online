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
                fs.renameSync(file.path, path.join(userModsDir, zipFileName));
                downloadUrl = `${serverBaseUrl}/uploads/${username}/mods/${zipFileName}`;
            } else if (file.fieldname === 'iconFile' || file.mimetype.startsWith('image/')) {
                const iconExt = path.extname(file.originalname) || '.png';
                const iconFileName = `${modName}_icon${iconExt}`;
                fs.renameSync(file.path, path.join(userModsDir, iconFileName));
                iconUrl = `${serverBaseUrl}/uploads/${username}/mods/${iconFileName}`;
            }
        });

        if (!downloadUrl) {
            return res.status(400).json({ error: "Missing required .zip mod file." });
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
