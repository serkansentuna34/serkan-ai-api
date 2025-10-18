const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const systemController = require('../../controllers/admin/systemController');

// Service Management
router.post('/restart', authenticateToken, requireAdmin, systemController.restartService);
router.get('/status', authenticateToken, requireAdmin, systemController.getServiceStatus);
router.get('/info', authenticateToken, requireAdmin, systemController.getSystemInfo);

// Ollama Management
router.get('/ollama/models', authenticateToken, requireAdmin, systemController.getOllamaModels);
router.post('/ollama/download', authenticateToken, requireAdmin, systemController.downloadOllamaModel);
router.delete('/ollama/delete', authenticateToken, requireAdmin, systemController.deleteOllamaModel);
router.get('/ollama/model/:model', authenticateToken, requireAdmin, systemController.getOllamaModelInfo);

// n8n Management
router.get('/n8n/workflows', authenticateToken, requireAdmin, systemController.getN8nWorkflows);
router.patch('/n8n/workflow/:workflowId', authenticateToken, requireAdmin, systemController.toggleN8nWorkflow);
router.delete('/n8n/workflow/:workflowId', authenticateToken, requireAdmin, systemController.deleteN8nWorkflow);
router.get('/n8n/workflow/:workflowId/export', authenticateToken, requireAdmin, systemController.exportN8nWorkflow);

// LangFlow Management
router.get('/langflow/flows', authenticateToken, requireAdmin, systemController.getLangFlows);
router.delete('/langflow/flow/:flowId', authenticateToken, requireAdmin, systemController.deleteLangFlow);

module.exports = router;
