# GEMINI Project Analysis

## Project Overview

This project is a Location-Based Authentication System. It's a web application built with Node.js and Express. The goal is to create a system where authentication is tied to the user's physical location. The project is in its early stages of development.

The backend is built on Node.js and Express. It uses Jade (Pug) for server-side templating. The database is being migrated from MongoDB to PostgreSQL.

## Building and Running

To get the application running, you'll need to have Node.js and npm installed.

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the application:**

    *   For production:
        ```bash
        npm start
        ```

    *   For development (with automatic server restart on file changes):
        ```bash
        npm run devstart
        ```

    *   For development (with debug output):
        ```bash
        npm run serverstart
        ```

## Development Conventions

*   **Routing:** Routes are defined in the `routes/` directory. `app.js` links the route files to their respective URL paths.
*   **Database:** The project is set up to use a PostgreSQL database. The connection is configured in `db/postgre.js`. The credentials seem to be hardcoded, which should be moved to environment variables.
*   **Views:** The frontend is rendered using the Jade (Pug) templating engine. View files are located in the `views/` directory.
*   **Static Files:** Static files like stylesheets and client-side JavaScript are served from the `public/` directory.
