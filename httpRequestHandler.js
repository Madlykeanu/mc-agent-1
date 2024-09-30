const axios = require('axios');
const util = require('util');

/**
 * Sends a POST request to the language model server and returns the response.
 * @param {string} url The URL of the language model server.
 * @param {Object} payload The payload to send in the POST request.
 * @returns {Promise<Object>} The response from the server as a JSON object....
 */
async function sendPostRequest(url, payload) {
    try {
        console.log('Sending POST request with payload:');
        console.log(util.inspect(payload, { depth: null, colors: true }));
        
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
        });
        
        //console.log('Response data:', JSON.stringify(response.data, null, 2));
        return response.data;
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
