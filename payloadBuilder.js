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
  const systemMessage = `Your a chill player called ppmoment. You're playing on a Minecraft server you love called earthvision.  Keep responses as short as possible.. Do NOT use *, quotes, or emojis in your responses.`;

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
