document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const adminSection = document.getElementById('admin-section');
    const userInfo = document.getElementById('userInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // New elements for map and modal
    const modal = document.getElementById('zone-modal');
    const createZoneBtn = document.getElementById('create-zone-btn');
    const closeBtn = document.querySelector('.close-btn');
    const zoneForm = document.getElementById('zone-form');
    const zoneNameInput = document.getElementById('zone-name');
    const zoneRadiusInput = document.getElementById('zone-radius');
    const zoneLatInput = document.getElementById('zone-lat');
    const zoneLngInput = document.getElementById('zone-lng');
    let zoneIdToUpdate = null; // To track which zone is being edited

    let map, selectedMarker;

    // Fetch user info and initialize admin features if applicable
    fetch('/api/users/me', {
        headers: { 'x-auth-token': token }
    })
    .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch user data'))
    .then(data => {
        userInfo.innerHTML = `<p>Username: ${data.username}</p><p>Role: ${data.role}</p>`;
        if (data.role === 'admin') {
            adminSection.style.display = 'block';
            initializeMap();
            loadZones();
        }
    })
    .catch(err => {
        console.error(err);
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    });

    function initializeMap() {
        map = L.map('map').setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            if (selectedMarker) {
                selectedMarker.setLatLng(e.latlng);
            } else {
                selectedMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
            }
            zoneLatInput.value = lat;
            zoneLngInput.value = lng;
            createZoneBtn.disabled = false;
        });
        createZoneBtn.disabled = true;
    }

    function loadZones() {
        fetch('/api/zones', {
            headers: { 'x-auth-token': token }
        })
        .then(response => response.json())
        .then(zones => {
            // Clear existing zone layers
            map.eachLayer(layer => {
                if (layer instanceof L.Circle) {
                    map.removeLayer(layer);
                }
            });

            zones.forEach(zone => {
                const circle = L.circle([zone.latitude, zone.longitude], {
                    color: 'blue',
                    fillColor: '#30f',
                    fillOpacity: 0.5,
                    radius: zone.radius
                }).addTo(map);

                const popupContent = `
                    <b>${zone.name}</b><br>
                    Radius: ${zone.radius}m<br>
                    <button class="edit-btn" data-id="${zone.id}" data-name="${zone.name}" data-radius="${zone.radius}" data-lat="${zone.latitude}" data-lng="${zone.longitude}">Edit</button>
                    <button class="delete-btn" data-id="${zone.id}">Delete</button>
                `;
                circle.bindPopup(popupContent);
            });
        });
    }

    // Modal Handling
    createZoneBtn.addEventListener('click', () => {
        if (!selectedMarker) {
            alert('Please select a location on the map first.');
            return;
        }
        zoneIdToUpdate = null; // Ensure we are in "create" mode
        zoneForm.reset();
        const { lat, lng } = selectedMarker.getLatLng();
        zoneLatInput.value = lat;
        zoneLngInput.value = lng;
        modal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Form Submission for Create/Update
    zoneForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const url = zoneIdToUpdate ? `/api/zones/${zoneIdToUpdate}` : '/api/zones';
        const method = zoneIdToUpdate ? 'PUT' : 'POST';

        const body = {
            name: zoneNameInput.value,
            radius: parseFloat(zoneRadiusInput.value),
            latitude: parseFloat(zoneLatInput.value),
            longitude: parseFloat(zoneLngInput.value)
        };

        fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(body)
        })
        .then(response => response.ok ? response.json() : Promise.reject('Failed to save zone'))
        .then(() => {
            modal.style.display = 'none';
            loadZones(); // Refresh zones on the map
            if (selectedMarker && !zoneIdToUpdate) { // Remove selection marker after creation
                 map.removeLayer(selectedMarker);
                 selectedMarker = null;
                 createZoneBtn.disabled = true;
            }
        })
        .catch(err => console.error(err));
    });

    // Event delegation for edit/delete buttons in popups
    document.getElementById('map').addEventListener('click', (e) => {
        const target = e.target;

        if (target.classList.contains('delete-btn')) {
            const zoneId = target.dataset.id;
            if (confirm('Are you sure you want to delete this zone?')) {
                fetch(`/api/zones/${zoneId}`, {
                    method: 'DELETE',
                    headers: { 'x-auth-token': token }
                })
                .then(response => {
                    if (response.ok) {
                        loadZones();
                        map.closePopup();
                    } else {
                        alert('Failed to delete zone.');
                    }
                });
            }
        }

        if (target.classList.contains('edit-btn')) {
            const { id, name, radius, lat, lng } = target.dataset;
            zoneIdToUpdate = id;
            zoneNameInput.value = name;
            zoneRadiusInput.value = radius;
            zoneLatInput.value = lat;
            zoneLngInput.value = lng;
            modal.style.display = 'block';
        }
    });
});
