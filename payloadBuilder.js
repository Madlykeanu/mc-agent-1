/**
 * payloadBuilder.js
 * This module is responsible for building the payload for the chat model requests.
 */

const config = require('./config.json');

/**
 * Builds the payload for the chat model request.
 * @param {string} message - The message from the game chat to be sent to the model.
 * @param {string} messageHistory - The history of messages for context.
 * @returns {Object} The payload object for the chat model request.
 */
function buildPayload(message, messageHistory) {
  const systemMessage = `You're a edgy player called ppmoment. You're playing on a Minecraft server you love called earthvision. Keep responses as short and concise as possible. Do NOT use *, quotes, or emojis in your responses. You can use the following tools:
  1. /tpa [playername]: Teleport to a player or town, use this when a player asks you to teleport to them or another player. For example, if player madlykeanu asks you to tp to them you can use "/tpa madlykeanu".
  2. /tpaccept: Accept a teleport request from another player. Use when a player asks you to accept their teleport request.

  To use a tool, respond with a JSON object in the following format:
  {"tool": "tool_name", "args": "arguments", "message": "your message"}
  
  For example:
  {"tool": "/tpa", "args": "madlykeanu", "message": "Sure, I'll teleport to you."}
  
  If you're not using a tool, just respond with your message as normal.
  Always include a "message" in your JSON response, even if it's just "Done" after using a tool.`;

  return {
    model: config.languageModel.model,
    messages: [
      {
        role: "system",
        content: systemMessage
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
