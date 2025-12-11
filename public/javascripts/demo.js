document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const latSpan = document.getElementById('lat');
    const lngSpan = document.getElementById('lng');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const messageDiv = document.getElementById('message');

    let selectedLocation = { lat: 51.505, lng: -0.09 };
    latSpan.textContent = selectedLocation.lat;
    lngSpan.textContent = selectedLocation.lng;

    const marker = L.marker(selectedLocation).addTo(map);

    map.on('click', function(e) {
        selectedLocation = e.latlng;
        latSpan.textContent = selectedLocation.lat;
        lngSpan.textContent = selectedLocation.lng;
        marker.setLatLng(selectedLocation);
    });

    // Fetch and display authorized zones
    fetch('/api/zones')
        .then(response => response.json())
        .then(zones => {
            zones.forEach(zone => {
                L.circle([zone.latitude, zone.longitude], {
                    color: 'blue',
                    fillColor: '#30f',
                    fillOpacity: 0.5,
                    radius: zone.radius
                }).addTo(map);
            });
        });

    loginBtn.addEventListener('click', () => {
        const user = {
            username: usernameInput.value,
            password: passwordInput.value,
            latitude: selectedLocation.lat,
            longitude: selectedLocation.lng
        };

        console.log('Posting data:', user);

        fetch('/api/auth/access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(user)
        })
        .then(response => response.json())
        .then(data => {
            const resultMessage = data.message || data.msg || 'Login failed.';
            messageDiv.innerHTML = `
                <p><strong>Result:</strong> ${resultMessage}</p>
                <p><strong>Location:</strong> Lat ${selectedLocation.lat}, Lng ${selectedLocation.lng}</p>
            `;
            messageDiv.style.color = data.token ? 'green' : 'red';
        })
        .catch(error => {
            console.error('Error:', error);
            messageDiv.innerHTML = `
                <p><strong>Error:</strong> Error during login. See console for details.</p>
                <p><strong>Location:</strong> Lat ${selectedLocation.lat}, Lng ${selectedLocation.lng}</p>
            `;
            messageDiv.style.color = 'red';
        });
    });
});
