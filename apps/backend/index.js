// node.js version v16.20.2
const app = require('express')();
const PORT = 8080;

app.listen(
    PORT, () => console.log(`Backend server is running on http://localhost:${PORT}`)
);
