/**
 * payloadBuilder.js
 * This module is responsible for building the payload for the chat model requests.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// Remove the global tools variable
// let tools = require('./tools.json');

// Add a function to load tools
function loadTools() {
  const toolsPath = path.join(__dirname, 'tools.json');
  const toolsData = fs.readFileSync(toolsPath, 'utf8');
  return JSON.parse(toolsData);
}

/**
 * Builds the payload for the chat model request.
 * @param {string} message - The message from the game chat to be sent to the model.
 * @param {string} messageHistory - The history of messages for context.
 * @returns {Object} The payload object for the chat model request.
 */
function buildPayload(message, messageHistory) {
  // Load tools before each prompt
  const tools = loadTools();

  const toolsDescription = tools.map(tool => 
    `${tool.name}: ${tool.description}. Usage: ${tool.usage}`
  ).join('\n');

  const systemMessage = `You're an helpful player called ppmoment. You're playing on a Minecraft server you love called earthvision. Keep responses as short and concise as possible. Do NOT use *, quotes, or emojis in your responses.

  Always respond with a JSON object in the following format:
  {
    "thought": "Your chain of thought or reasoning (be detailed but concise)",
    "shouldRespond": true or false, you can decide whether to respond to a message. Ignore server messages, irrelevant chatter, or messages not directed at you.
    "newTool": { "name": "tool_name", "description": "tool_description", "usage": "tool_usage", "args": ["arg1", "arg2"] } or null if no new tool is being added,
    "tool": "tool_name or null if not using a tool",
    "args": "arguments for the tool or null if not applicable",
    "message": "Your final message to be sent in the game chat or null if not responding"
  }
  
  Always include all fields in your JSON response, using null for newTool, tool, args, and message when not applicable.
  If a player tells you about a new command you can use, include it in the newTool field.
  Provide detailed thoughts that show your decision-making process, including why you chose to respond or not respond.`;

  return {
    model: config.languageModel.model,
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "system",
        content: `Available tools:\n${toolsDescription}`
      },
      {
        role: "system",
        content: `Ingame chat history for context: ${messageHistory}`
      },
      {
        role: "user",
        content: message
      }
    ],
    temperature: config.languageModel.temperature,
    max_tokens: config.languageModel.max_tokens
  };
}

function addNewTool(newTool) {
  if (!newTool || !newTool.name || !newTool.description || !newTool.usage) {
    return "Error: Invalid tool format";
  }

  // Load the current tools
  const tools = loadTools();

  // Check if the tool already exists
  const existingTool = tools.find(tool => tool.name === newTool.name);
  if (existingTool) {
    return `Tool ${newTool.name} already exists`;
  }

  // Add the new tool
  tools.push(newTool);

  // Save the updated tools to the JSON file
  const toolsPath = path.join(__dirname, 'tools.json');
  fs.writeFileSync(toolsPath, JSON.stringify(tools, null, 2));

  return `New tool ${newTool.name} added successfully`;
}

module.exports = { buildPayload, addNewTool };
