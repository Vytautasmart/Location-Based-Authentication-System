document.addEventListener('DOMContentLoaded', () => {
    const latSpan = document.getElementById('lat');
    const lngSpan = document.getElementById('lng');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const messageDiv = document.getElementById('message');

    const initialLocation = { lat: 51.505, lng: -0.09 };
    latSpan.textContent = initialLocation.lat;
    lngSpan.textContent = initialLocation.lng;
    let selectedLocation = initialLocation;

    const map = L.map('map').setView([initialLocation.lat, initialLocation.lng], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    const marker = L.marker([initialLocation.lat, initialLocation.lng]).addTo(map);

    map.on('click', (e) => {
        selectedLocation = e.latlng;
        marker.setLatLng(e.latlng);
        latSpan.textContent = selectedLocation.lat;
        lngSpan.textContent = selectedLocation.lng;
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
        .then(response => {
            if (response.status === 400 || response.status === 403) {
                return response.json().then(err => {
                    throw new Error(err.msg);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Login successful, data:', data);
            const resultMessage = data.message || 'Login successful!';
            messageDiv.innerHTML = `
                <p><strong>Result:</strong> ${resultMessage}</p>
                <p><strong>Location:</strong> Lat ${selectedLocation.lat}, Lng ${selectedLocation.lng}</p>
            `;
            messageDiv.style.color = 'green';
        })
        .catch(error => {
            console.error('Login failed, error:', error);
            messageDiv.innerHTML = `
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Location:</strong> Lat ${selectedLocation.lat}, Lng ${selectedLocation.lng}</p>
            `;
            messageDiv.style.color = 'red';
        });
    });
});
