document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
    }

    const adminSection = document.getElementById('admin-section');
    const zoneForm = document.getElementById('zone-form');
    const zoneIdInput = document.getElementById('zone-id');
    const zoneNameInput = document.getElementById('zone-name');
    const zoneLatInput = document.getElementById('zone-lat');
    const zoneLngInput = document.getElementById('zone-lng');
    const zoneRadiusInput = document.getElementById('zone-radius');
    const zonesTableBody = document.querySelector('#zones-table tbody');

    fetch('/api/users/me', {
        headers: {
            'x-auth-token': token
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            const userInfo = document.getElementById('userInfo');
            userInfo.innerHTML = `<p>Username: ${data.username}</p><p>Role: ${data.role}</p>`;
            if (data.role === 'admin') {
                adminSection.style.display = 'block';
                loadZones();
            }
        } else {
            window.location.href = '/index.html';
        }
    })
    .catch(err => {
        console.error(err);
        window.location.href = '/index.html';
    });

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    });

    function loadZones() {
        fetch('/api/zones', {
            headers: { 'x-auth-token': token }
        })
        .then(response => response.json())
        .then(zones => {
            zonesTableBody.innerHTML = '';
            zones.forEach(zone => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${zone.name}</td>
                    <td>${zone.latitude}</td>
                    <td>${zone.longitude}</td>
                    <td>${zone.radius}</td>
                    <td>
                        <button class="edit-btn" data-id="${zone.id}">Edit</button>
                        <button class="delete-btn" data-id="${zone.id}">Delete</button>
                    </td>
                `;
                zonesTableBody.appendChild(row);
            });
        });
    }

    zoneForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = zoneIdInput.value;
        const url = id ? `/api/zones/${id}` : '/api/zones';
        const method = id ? 'PUT' : 'POST';

        const body = {
            name: zoneNameInput.value,
            latitude: zoneLatInput.value,
            longitude: zoneLngInput.value,
            radius: zoneRadiusInput.value
        };

        fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(body)
        })
        .then(response => response.json())
        .then(() => {
            zoneForm.reset();
            zoneIdInput.value = '';
            loadZones();
        });
    });

    zonesTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            fetch(`/api/zones/${id}`, {
                method: 'DELETE',
                headers: { 'x-auth-token': token }
            })
            .then(() => loadZones());
        }

        if (e.target.classList.contains('edit-btn')) {
            const row = e.target.closest('tr');
            const id = e.target.dataset.id;
            zoneIdInput.value = id;
            zoneNameInput.value = row.cells[0].textContent;
            zoneLatInput.value = row.cells[1].textContent;
            zoneLngInput.value = row.cells[2].textContent;
            zoneRadiusInput.value = row.cells[3].textContent;
        }
    });
});
