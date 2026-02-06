require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request Logger (Important for production debugging)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Configure Multer for RAM storage (buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

// OAuth2 Client Configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Set Refresh Token
if (process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
} else {
    console.warn("WARNING: GOOGLE_REFRESH_TOKEN is missing. Upload APIs will fail.");
}

// Drive Client
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'RenTelMe Backend is Running',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

app.get('/auth', (req, res) => {
    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
    });
    res.redirect(authorizationUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided');
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('REFRESH TOKEN:', tokens.refresh_token);
        res.send(`<h3>Success!</h3><p>Refresh Token: ${tokens.refresh_token}</p>`);
    } catch (error) {
        res.status(500).send('Error');
    }
});

/**
 * 4. PROXY IMAGE ENDPOINT (THE FIX)
 * Instead of linking to Google, we stream the image through our server.
 * Usage: http://localhost:3000/image/FILE_ID
 */
app.get('/image/:fileId', async (req, res) => {
    const { fileId } = req.params;
    try {
        // 1. Get file metadata (to set correct Content-Type)
        const file = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType, name'
        });

        res.setHeader('Content-Type', file.data.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

        // 2. Stream file content
        const result = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, { responseType: 'stream' });

        result.data
            .on('end', () => { })
            .on('error', (err) => {
                console.error('Stream error', err);
                res.status(500).end();
            })
            .pipe(res);

    } catch (error) {
        console.error('Error serving image:', error.message);
        res.status(404).send('Image not found or access denied');
    }
});

/**
 * 5. DELETE IMAGE ENDPOINT
 * Deletes a file from Google Drive.
 * Usage: DELETE http://localhost:3000/image/FILE_ID
 */
app.delete('/image/:fileId', async (req, res) => {
    const { fileId } = req.params;
    try {
        await drive.files.delete({
            fileId: fileId,
        });
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error.message);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        // A. Upload
        const fileMetadata = { name: `${Date.now()}_${req.file.originalname}` };
        const media = {
            mimeType: req.file.mimetype,
            body: require('stream').Readable.from(req.file.buffer),
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        const fileId = response.data.id;

        // B. Make Public (Still good practice)
        await drive.permissions.create({
            fileId: fileId,
            requestBody: { role: 'reader', type: 'anyone' },
        });

        // C. Return PROXY URL
        // Dynamically choose URL based on environment
        const baseUrl = process.env.NODE_ENV === 'production'
            ? 'https://rentelme-server.onrender.com'
            : `http://localhost:${PORT}`;

        const proxyUrl = `${baseUrl}/image/${fileId}`;

        res.status(200).json({
            message: 'Uploaded',
            fileId: fileId,
            displayUrl: proxyUrl
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
