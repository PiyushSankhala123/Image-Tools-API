const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const Image = require('../models/Image');

const router = express.Router();

const processedDir = path.join(__dirname, '..', 'processed');
if (!fs.existsSync(processedDir)) 
{
    fs.mkdirSync(processedDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) 
        {
            return cb(null, true);
        }
        cb(new Error('Error: File upload only supports the following filetypes - ' + filetypes));
    }
}).single('image');

router.post('/process', protect, upload, async (req, res) => {
    if (!req.file) 
    {
        return res.status(400).json({ success: false, message: 'Please upload an image' });
    }

    try 
    {
        const 
        {
            format = 'jpeg',
            width,
            height,
            compressSize,
            brightness,
            contrast
        } = req.body;

        let image = sharp(req.file.buffer);
        const operations = {};

        if (width && height) 
        {
            image.resize({
                width: parseInt(width),
                height: parseInt(height),
                fit: 'fill'
            });
            operations.resize = { width, height };
        }

        if (brightness || contrast) 
        {
            const brightVal = parseFloat(brightness) || 1.0;
            const contrastVal = parseFloat(contrast) || 0.0;
            image.modulate({ brightness: brightVal });
            if (contrastVal != 0.0) 
            {
                 operations.adjustment = { brightness, contrast };
            }
        }
        
        image.toFormat(format);
        operations.format = format;

        let outputBuffer;
        let finalQuality = 'N/A';

        if (compressSize && (format === 'jpeg' || format === 'webp')) 
        {
            const targetBytes = parseInt(compressSize) * 1024;
            operations.compression = { targetSizeKB: compressSize };

            let minQuality = 1;
            let maxQuality = 100;
            let currentQuality;
            let bestBuffer;

            for(let i=0; i < 7; i++) 
            {
                 currentQuality = Math.floor((minQuality + maxQuality) / 2);
                 if (currentQuality === 0) currentQuality = 1;

                 let tempBuffer;
                 if (format === 'jpeg') 
                 {
                    tempBuffer = await image.jpeg({ quality: currentQuality }).toBuffer();
                 } 
                 else 
                 {
                    tempBuffer = await image.webp({ quality: currentQuality }).toBuffer();
                 }

                 if (tempBuffer.length <= targetBytes) 
                 {
                     bestBuffer = tempBuffer;
                     minQuality = currentQuality + 1;
                 } 
                 else 
                 {
                     maxQuality = currentQuality - 1;
                 }
            }

            outputBuffer = bestBuffer || await image.jpeg({ quality: 1 }).toBuffer();
            finalQuality = currentQuality;
            operations.compression.finalQuality = finalQuality;

        } 
        else 
        {
            outputBuffer = await image.toBuffer();
        }

        const originalName = path.parse(req.file.originalname).name;
        const timestamp = Date.now();
        const processedFileName = `${originalName}-${req.user.id}-${timestamp}.${format}`;
        const outputPath = path.join(processedDir, processedFileName);

        await fs.promises.writeFile(outputPath, outputBuffer);
        
        const newImage = new Image({
            user: req.user.id,
            originalName: req.file.originalname,
            processedFileName,
            path: `/processed/${processedFileName}`,
            operations
        });

        await newImage.save();

        res.status(200).json({
            success: true,
            message: 'Image processed successfully',
            data: newImage
        });

    } 
    catch (err) 
    {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error during image processing.' });
    }
});

router.delete('/:id', protect, async (req, res) => {
    try 
    {
        const image = await Image.findById(req.params.id);

        if (!image) 
        {
            return res.status(404).json({ success: false, message: 'Image not found' });
        }

        if (image.user.toString() !== req.user.id) 
        {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const filePath = path.join(processedDir, image.processedFileName);
        if (fs.existsSync(filePath)) 
        {
            await fs.promises.unlink(filePath);
        }

        await image.remove();

        res.json({ success: true, message: 'Image deleted successfully' });

    } 
    catch (err) 
    {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

router.delete('/clear-all', protect, async (req, res) => {
    try 
    {
        const images = await Image.find({ user: req.user.id });

        if (images.length === 0) 
        {
            return res.status(200).json({ success: true, message: 'No images to delete.' });
        }

        for (const image of images) 
        {
            const filePath = path.join(processedDir, image.processedFileName);
            if (fs.existsSync(filePath)) 
            {
                await fs.promises.unlink(filePath);
            }
        }

        await Image.deleteMany({ user: req.user.id });

        res.json({ success: true, message: 'All images have been cleared.' });

    } 
    catch (err) 
    {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
