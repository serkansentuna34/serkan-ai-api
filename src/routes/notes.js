const express = require('express');
const router = express.Router();
const {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  emailNotes
} = require('../controllers/notesController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getAllNotes);
router.get('/:id', authenticate, getNoteById);
router.post('/', authenticate, createNote);
router.put('/:id', authenticate, updateNote);
router.delete('/:id', authenticate, deleteNote);
router.post('/email', authenticate, emailNotes);

module.exports = router;
