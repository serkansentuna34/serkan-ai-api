const express = require('express');
const router = express.Router();
const shortTrainingController = require('../controllers/shortTrainingController');
const { authenticate } = require('../middleware/auth');

// Protect all routes - only authenticated students
router.use(authenticate);

// GET /api/short-training/today-schedule - Bugünün programı
router.get('/today-schedule', shortTrainingController.getTodaySchedule);

// GET /api/short-training/day-tracking - Günlük ilerleme takibi
router.get('/day-tracking', shortTrainingController.getDayTracking);

// GET /api/short-training/materials - Ders materyalleri
router.get('/materials', shortTrainingController.getCourseMaterials);

// GET /api/short-training/certificate-status - Sertifika durumu
router.get('/certificate-status', shortTrainingController.getCertificateStatus);

// POST /api/short-training/check-in - Yoklama verme
router.post('/check-in', shortTrainingController.checkIn);

// Quick Notes
router.get('/quick-notes', shortTrainingController.getQuickNotes);
router.post('/quick-notes', shortTrainingController.createQuickNote);
router.delete('/quick-notes/:id', shortTrainingController.deleteQuickNote);

module.exports = router;
