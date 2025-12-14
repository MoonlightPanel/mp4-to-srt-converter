require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Set FFmpeg path (optional - adjust based on your system)
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/mpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4 files are allowed'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// Routes

// Home page
app.get('/', (req, res) => {
  res.render('index');
});

// Handle file upload and conversion
app.post('/api/convert', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputPath = req.file.path;
    const outputFileName = `${path.parse(req.file.originalname).name}.srt`;
    const outputPath = path.join(outputDir, outputFileName);
    const conversionId = uuidv4();

    // Store conversion status
    req.app.locals.conversions = req.app.locals.conversions || {};
    req.app.locals.conversions[conversionId] = {
      status: 'processing',
      progress: 0,
      inputFile: req.file.originalname,
      outputFile: outputFileName
    };

    // Start FFmpeg conversion
    ffmpeg(inputPath)
      .output(outputPath)
      .on('start', (command) => {
        console.log(`Conversion started for ${req.file.originalname}`);
        req.app.locals.conversions[conversionId].status = 'processing';
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          req.app.locals.conversions[conversionId].progress = Math.round(progress.percent);
        }
      })
      .on('end', () => {
        console.log(`Conversion completed for ${req.file.originalname}`);
        req.app.locals.conversions[conversionId].status = 'completed';
        req.app.locals.conversions[conversionId].progress = 100;

        // Clean up uploaded file
        fs.unlink(inputPath, (err) => {
          if (err) console.error('Error deleting upload:', err);
        });

        res.json({
          success: true,
          conversionId: conversionId,
          outputFile: outputFileName,
          message: 'Conversion completed successfully'
        });
      })
      .on('error', (err) => {
        console.error(`Conversion error for ${req.file.originalname}:`, err);
        req.app.locals.conversions[conversionId].status = 'error';
        req.app.locals.conversions[conversionId].error = err.message;

        // Clean up files
        fs.unlink(inputPath, (err) => {
          if (err) console.error('Error deleting upload:', err);
        });

        res.status(500).json({
          success: false,
          error: 'Conversion failed: ' + err.message
        });
      })
      .run();

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversion status
app.get('/api/status/:conversionId', (req, res) => {
  const { conversionId } = req.params;
  const conversions = req.app.locals.conversions || {};
  const conversion = conversions[conversionId];

  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  res.json(conversion);
});

// Download converted file
app.get('/api/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(outputDir, fileName);

  // Validate file path to prevent directory traversal
  if (!filePath.startsWith(outputDir)) {
    return res.status(403).json({ error: 'Invalid file path' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Download error:', err);
    } else {
      // Optionally delete file after download
      // fs.unlink(filePath, (err) => {
      //   if (err) console.error('Error deleting file:', err);
      // });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
