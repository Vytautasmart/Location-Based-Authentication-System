document.addEventListener('DOMContentLoaded', () => {
    // Function to load external HTML content into a specified element
    async function loadHTML(elementId, filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            document.getElementById(elementId).innerHTML = html;
        } catch (error) {
            console.error(`Could not load ${filePath}:`, error);
        }
    }

    // Load the navbar into a div with id="navbar-placeholder" on all pages
    // You would typically add a placeholder div in your HTML files: <div id="navbar-placeholder"></div>
    loadHTML('navbar-placeholder', '/components/navbar.html');
});
