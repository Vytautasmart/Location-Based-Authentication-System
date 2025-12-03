document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('locationForm');
    const requestDataOutput = document.getElementById('requestData');
    const responseDataOutput = document.getElementById('responseData');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const latitude = parseFloat(document.getElementById('latitude').value);
        const longitude = parseFloat(document.getElementById('longitude').value);

        const requestData = {
            username,
            password,
            location: {
                latitude,
                longitude
            }
        };

        // Display the request data
        requestDataOutput.textContent = JSON.stringify(requestData, null, 2);

        try {
            const response = await fetch('/api/auth/access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const responseBody = await response.json();
            
            // Display the response data
            responseDataOutput.textContent = JSON.stringify({
                status: response.status,
                statusText: response.statusText,
                body: responseBody
            }, null, 2);

        } catch (error) {
            responseDataOutput.textContent = `Error: ${error.message}`;
        }
    });
});
