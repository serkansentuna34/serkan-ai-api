const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

// Upload single file
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    const file = req.file;
    const fileUrl = `/uploads/${file.filename}`;

    // Save file info to database
    const result = await pool.query(
      `INSERT INTO uploaded_files (filename, original_name, mimetype, size, path, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [file.filename, file.originalname, file.mimetype, file.size, fileUrl, req.user.id]
    );

    res.json({
      message: 'Dosya başarıyla yüklendi',
      file: {
        id: result.rows[0].id,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Dosya yüklenirken hata oluştu' });
  }
};

// Upload multiple files
const uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const fileUrl = `/uploads/${file.filename}`;

      const result = await pool.query(
        `INSERT INTO uploaded_files (filename, original_name, mimetype, size, path, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [file.filename, file.originalname, file.mimetype, file.size, fileUrl, req.user.id]
      );

      uploadedFiles.push({
        id: result.rows[0].id,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: fileUrl
      });
    }

    res.json({
      message: 'Dosyalar başarıyla yüklendi',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Dosyalar yüklenirken hata oluştu' });
  }
};

// Get uploaded files
const getUploadedFiles = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uf.*, u.name as uploader_name
       FROM uploaded_files uf
       LEFT JOIN users u ON uf.uploaded_by = u.id
       ORDER BY uf.created_at DESC`
    );

    res.json({ files: result.rows });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Dosyalar yüklenirken hata oluştu' });
  }
};

// Delete uploaded file
const deleteUploadedFile = async (req, res) => {
  try {
    const { id } = req.params;

    // Get file info
    const fileResult = await pool.query(
      'SELECT * FROM uploaded_files WHERE id = $1',
      [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dosya bulunamadı' });
    }

    const file = fileResult.rows[0];

    // Delete file from filesystem
    const filePath = path.join(__dirname, '../../uploads', file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await pool.query('DELETE FROM uploaded_files WHERE id = $1', [id]);

    res.json({ message: 'Dosya başarıyla silindi' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Dosya silinirken hata oluştu' });
  }
};

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  getUploadedFiles,
  deleteUploadedFile
};
