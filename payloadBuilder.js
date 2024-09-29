/**
 * payloadBuilder.js
 * This module is responsible for building the payload for the chat model requests.
 */

const config = require('./config.json');
const tools = require('./tools.json');

/**
 * Builds the payload for the chat model request.
 * @param {string} message - The message from the game chat to be sent to the model.
 * @param {string} messageHistory - The history of messages for context.
 * @returns {Object} The payload object for the chat model request.
 */
function buildPayload(message, messageHistory) {
  const toolsDescription = tools.map(tool => 
    `${tool.name}: ${tool.description}. Usage: ${tool.usage}`
  ).join('\n');

  const systemMessage = `You're an edgy player called ppmoment. You're playing on a Minecraft server you love called earthvision. Keep responses as short and concise as possible. Do NOT use *, quotes, or emojis in your responses.

  Always respond with a JSON object in the following format:
  {
    "thought": "Your chain of thought or reasoning (be detailed but concise)",
    "shouldRespond": true or false, you can decide whether to respond to a message. Ignore server messages, irrelevant chatter, or messages not directed at you.
    "tool": "tool_name or null if not using a tool",
    "args": "arguments for the tool or null if not applicable",
    "message": "Your final message to be sent in the game chat or null if not responding"
  }
  
  Always include all fields in your JSON response, using null for tool, args, and message when not applicable.
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

module.exports = { buildPayload };
