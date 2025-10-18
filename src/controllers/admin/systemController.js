const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');
const execPromise = util.promisify(exec);

// Restart Docker service
const restartService = async (req, res) => {
  try {
    const { service } = req.body;

    // Security: Only allowed services
    const allowedServices = ['n8n', 'langflow', 'ollama', 'api', 'portal'];
    if (!allowedServices.includes(service)) {
      return res.status(400).json({ error: 'Invalid service name' });
    }

    console.log(`Restarting service: ${service}`);

    const { stdout, stderr } = await execPromise(`docker compose restart ${service}`);

    console.log('Restart output:', stdout);
    if (stderr) console.error('Restart stderr:', stderr);

    res.json({
      success: true,
      message: `${service} restarted successfully`,
      output: stdout
    });
  } catch (error) {
    console.error('Restart error:', error);
    res.status(500).json({
      error: 'Failed to restart service',
      details: error.message
    });
  }
};

// Get service status
const getServiceStatus = async (req, res) => {
  try {
    const { stdout } = await execPromise('docker compose ps --format json');
    const containers = stdout.trim().split('\n').map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(c => c !== null);

    const services = containers.map(c => ({
      name: c.Service,
      status: c.State,
      health: c.Health || 'N/A',
      ports: c.Publishers || []
    }));

    res.json({ services });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
};

// ============= OLLAMA MANAGEMENT =============

// Get Ollama models list
const getOllamaModels = async (req, res) => {
  try {
    const response = await axios.get('http://ollama:11434/api/tags');
    const models = response.data.models?.map(m => m.name) || [];

    res.json({
      models,
      count: models.length
    });
  } catch (error) {
    console.error('Failed to get Ollama models:', error);
    res.status(500).json({
      error: 'Failed to fetch models',
      models: []
    });
  }
};

// Download Ollama model
const downloadOllamaModel = async (req, res) => {
  try {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    // Validate model name (basic security)
    if (!/^[a-zA-Z0-9\.\-\_\:]+$/.test(model)) {
      return res.status(400).json({ error: 'Invalid model name format' });
    }

    console.log(`Downloading Ollama model: ${model}`);

    // Start download in background
    axios.post('http://ollama:11434/api/pull', { name: model })
      .then(() => {
        console.log(`Model ${model} download completed`);
      })
      .catch(error => {
        console.error(`Model ${model} download failed:`, error);
      });

    res.json({
      success: true,
      message: `Model ${model} download started. This may take several minutes.`,
      model
    });
  } catch (error) {
    console.error('Download model error:', error);
    res.status(500).json({
      error: 'Failed to download model',
      details: error.message
    });
  }
};

// Delete Ollama model
const deleteOllamaModel = async (req, res) => {
  try {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    console.log(`Deleting Ollama model: ${model}`);

    await axios.delete('http://ollama:11434/api/delete', {
      data: { name: model }
    });

    res.json({
      success: true,
      message: `Model ${model} deleted successfully`,
      model
    });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({
      error: 'Failed to delete model',
      details: error.message
    });
  }
};

// Get Ollama model info
const getOllamaModelInfo = async (req, res) => {
  try {
    const { model } = req.params;

    const response = await axios.post('http://ollama:11434/api/show', {
      name: model
    });

    res.json({
      model: model,
      info: response.data
    });
  } catch (error) {
    console.error('Get model info error:', error);
    res.status(500).json({
      error: 'Failed to get model info',
      details: error.message
    });
  }
};

// ============= N8N MANAGEMENT =============

// Get n8n workflows
const getN8nWorkflows = async (req, res) => {
  try {
    // n8n API requires authentication
    const n8nUrl = process.env.N8N_URL || 'http://n8n:5678';
    const n8nUser = process.env.N8N_USER || 'admin';
    const n8nPassword = process.env.N8N_PASSWORD || 'changeme';

    const auth = Buffer.from(`${n8nUser}:${n8nPassword}`).toString('base64');

    const response = await axios.get(`${n8nUrl}/api/v1/workflows`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    res.json({
      workflows: response.data.data || [],
      count: response.data.data?.length || 0
    });
  } catch (error) {
    console.error('Failed to get n8n workflows:', error);
    res.status(500).json({
      error: 'Failed to fetch workflows',
      workflows: []
    });
  }
};

// Activate/Deactivate n8n workflow
const toggleN8nWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { active } = req.body;

    const n8nUrl = process.env.N8N_URL || 'http://n8n:5678';
    const n8nUser = process.env.N8N_USER || 'admin';
    const n8nPassword = process.env.N8N_PASSWORD || 'changeme';

    const auth = Buffer.from(`${n8nUser}:${n8nPassword}`).toString('base64');

    await axios.patch(
      `${n8nUrl}/api/v1/workflows/${workflowId}`,
      { active },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: `Workflow ${active ? 'activated' : 'deactivated'} successfully`,
      workflowId,
      active
    });
  } catch (error) {
    console.error('Toggle workflow error:', error);
    res.status(500).json({
      error: 'Failed to toggle workflow',
      details: error.message
    });
  }
};

// Delete n8n workflow
const deleteN8nWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;

    const n8nUrl = process.env.N8N_URL || 'http://n8n:5678';
    const n8nUser = process.env.N8N_USER || 'admin';
    const n8nPassword = process.env.N8N_PASSWORD || 'changeme';

    const auth = Buffer.from(`${n8nUser}:${n8nPassword}`).toString('base64');

    await axios.delete(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    res.json({
      success: true,
      message: 'Workflow deleted successfully',
      workflowId
    });
  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({
      error: 'Failed to delete workflow',
      details: error.message
    });
  }
};

// Export n8n workflow
const exportN8nWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;

    const n8nUrl = process.env.N8N_URL || 'http://n8n:5678';
    const n8nUser = process.env.N8N_USER || 'admin';
    const n8nPassword = process.env.N8N_PASSWORD || 'changeme';

    const auth = Buffer.from(`${n8nUser}:${n8nPassword}`).toString('base64');

    const response = await axios.get(`${n8nUrl}/api/v1/workflows/${workflowId}`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    res.json({
      workflow: response.data
    });
  } catch (error) {
    console.error('Export workflow error:', error);
    res.status(500).json({
      error: 'Failed to export workflow',
      details: error.message
    });
  }
};

// ============= LANGFLOW MANAGEMENT =============

// Get LangFlow flows
const getLangFlows = async (req, res) => {
  try {
    const langflowUrl = process.env.LANGFLOW_URL || 'http://langflow:7860';

    const response = await axios.get(`${langflowUrl}/api/v1/flows`);

    res.json({
      flows: response.data || [],
      count: response.data?.length || 0
    });
  } catch (error) {
    console.error('Failed to get LangFlow flows:', error);
    res.status(500).json({
      error: 'Failed to fetch flows',
      flows: []
    });
  }
};

// Delete LangFlow flow
const deleteLangFlow = async (req, res) => {
  try {
    const { flowId } = req.params;

    const langflowUrl = process.env.LANGFLOW_URL || 'http://langflow:7860';

    await axios.delete(`${langflowUrl}/api/v1/flows/${flowId}`);

    res.json({
      success: true,
      message: 'Flow deleted successfully',
      flowId
    });
  } catch (error) {
    console.error('Delete flow error:', error);
    res.status(500).json({
      error: 'Failed to delete flow',
      details: error.message
    });
  }
};

// ============= SYSTEM INFO =============

// Get system resources
const getSystemInfo = async (req, res) => {
  try {
    const { stdout: dockerStats } = await execPromise('docker stats --no-stream --format "{{json .}}"');

    const stats = dockerStats.trim().split('\n').map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(s => s !== null);

    res.json({
      containers: stats.map(s => ({
        name: s.Name,
        cpu: s.CPUPerc,
        memory: s.MemUsage,
        memoryPerc: s.MemPerc,
        network: s.NetIO,
        block: s.BlockIO
      }))
    });
  } catch (error) {
    console.error('Get system info error:', error);
    res.status(500).json({
      error: 'Failed to get system info',
      details: error.message
    });
  }
};

module.exports = {
  restartService,
  getServiceStatus,
  getOllamaModels,
  downloadOllamaModel,
  deleteOllamaModel,
  getOllamaModelInfo,
  getN8nWorkflows,
  toggleN8nWorkflow,
  deleteN8nWorkflow,
  exportN8nWorkflow,
  getLangFlows,
  deleteLangFlow,
  getSystemInfo
};
