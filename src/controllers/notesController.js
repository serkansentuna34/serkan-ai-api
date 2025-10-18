const db = require('../config/database');
const { sendNotesEmail } = require('../services/emailService');

const getAllNotes = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT n.*, l.title as lesson_title
       FROM notes n
       LEFT JOIN lessons l ON n.lesson_id = l.id
       WHERE n.user_id = $1
       ORDER BY n.updated_at DESC`,
      [req.user.id]
    );

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT n.*, l.title as lesson_title
       FROM notes n
       LEFT JOIN lessons l ON n.lesson_id = l.id
       WHERE n.id = $1 AND n.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ note: result.rows[0] });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
};

const createNote = async (req, res) => {
  try {
    const { title, content, tags, lesson_id } = req.body;

    const result = await db.query(
      `INSERT INTO notes (user_id, title, content, tags, lesson_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, content, tags, lesson_id]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
};

const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags, lesson_id } = req.body;

    const result = await db.query(
      `UPDATE notes
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           tags = COALESCE($3, tags),
           lesson_id = COALESCE($4, lesson_id)
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [title, content, tags, lesson_id, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ note: result.rows[0] });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
};

const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
};

const emailNotes = async (req, res) => {
  try {
    const { noteIds } = req.body;
    console.log('Email notes request - noteIds:', noteIds);
    console.log('Request body:', req.body);

    // If no note IDs provided, return error
    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'Lütfen göndermek istediğiniz notları seçin' });
    }

    // Get selected notes
    const placeholders = noteIds.map((_, index) => `$${index + 2}`).join(', ');
    const result = await db.query(
      `SELECT n.*, l.title as lesson_title
       FROM notes n
       LEFT JOIN lessons l ON n.lesson_id = l.id
       WHERE n.user_id = $1 AND n.id IN (${placeholders})
       ORDER BY n.updated_at DESC`,
      [req.user.id, ...noteIds]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seçili notlar bulunamadı' });
    }

    const notes = result.rows;
    const userEmail = req.user.email;
    const userName = req.user.name || req.user.email.split('@')[0];

    // Send email
    const emailResult = await sendNotesEmail(userEmail, userName, notes);

    res.json({
      message: `${notes.length} adet not email adresinize gönderildi`,
      totalNotes: notes.length,
      ...emailResult
    });
  } catch (error) {
    console.error('Email notes error:', error);
    res.status(500).json({
      error: 'Notlar email olarak gönderilemedi',
      details: error.message
    });
  }
};

module.exports = {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  emailNotes
};
