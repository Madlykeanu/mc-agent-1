/**
 * payloadBuilder.js
 * This module is responsible for building the payload for the chat model requests.
 */

/**
 * Builds the payload for the chat model request.
 * @param {string} message - The message from the game chat to be sent to the model.
 * @returns {Object} The payload object for the chat model request.
 */
function buildPayload(message) {
  // Define the base structure of the payload
  const payload = {
    messages: [
      {
        role: "system",
        content: "Always answer in rhymes."
      },
      {
        role: "user",
        content: message // The message from the game chat
      }
    ],
    temperature: 0.7,
    max_tokens: -1,
    stream: false
  };

  return payload;
}

module.exports = { buildPayload };
