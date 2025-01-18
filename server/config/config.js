const dotenv = require('dotenv');

dotenv.config();

const config = {
  endpoint: process.env.ENDPOINT,
  apiKey: process.env.API_KEY,
  deploymentModel: process.env.DEPLOYMENT_OR_MODEL,
  isAzureOpenAI: process.env.IS_AZURE_OPENAI === 'true',
  systemMessage: process.env.SYSTEM_MESSAGE,
  temperature: parseFloat(process.env.TEMPERATURE) || 0.8,
  voice: process.env.VOICE,
  port: process.env.PORT || 5000
};

const getConfig = () => {
  // Validate required configuration
  if (!config.endpoint) throw new Error('ENDPOINT is required');
  if (!config.apiKey) throw new Error('API_KEY is required');
  if (!config.deploymentModel) throw new Error('DEPLOYMENT_OR_MODEL is required');
  
  return {
    getEndpoint: () => config.endpoint,
    getApiKey: () => config.apiKey,
    getDeploymentModel: () => config.deploymentModel,
    getIsAzureOpenAI: () => config.isAzureOpenAI,
    getSystemMessage: () => config.systemMessage,
    getTemperature: () => config.temperature,
    getVoice: () => config.voice,
    getPort: () => config.port
  };
};

module.exports = getConfig(); 