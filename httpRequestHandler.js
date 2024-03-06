const axios = require('axios');

/**
 * Sends a POST request to the language model server and returns the response.
 * @param {string} url The URL of the language model server.
 * @param {Object} payload The payload to send in the POST request.
 * @returns {Promise<Object>} The response from the server as a JSON object.
 */
async function sendPostRequest(url, payload) {
    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        console.log('Response data:', response.data); // Print the response data
        return response.data; // axios wraps the response data in a 'data' property
    } catch (error) {
        // axios encapsulates errors in an 'error.response' object
        if (error.response) {
            // The server responded with a status code outside the 2xx range
            console.error('Error data:', error.response.data);
            console.error('Error status:', error.response.status);
            throw new Error(`Server responded with status code ${error.response.status}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
            throw new Error('No response received from the server.');
        } else {
            // Something else caused the request to fail
            console.error('Error:', error.message);
            throw new Error('Error making the request.');
        }
    }
}

module.exports = { sendPostRequest };
