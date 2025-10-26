``` mermaid

flowchart TB
    C["Client Device (Web/Mobile) Collects credentials & location"]
    LS["Location Services GPS & Wi-Fi API (Google/Apple Geolocation)"]
    ST["Secure Transmission HTTPS/TLS JSON with credentials & location"]
    AS["Authentication Server (REST API: Node.js/Django) Verifies credentials"]
    DB["Database PostgreSQL/MySQL Stores users, locations, logs"]
    VF["Location & Credentials Verification\nGeofencing, anti-spoofing"]
    GD["Grant/Deny Access Return session token / error"]

    %% Data collection & location
    C -.-> LS
    C -.-> ST
    LS --> ST

    %% Server-side checks
    ST --> AS
    AS --> DB
    AS --> VF
    DB --> VF

    %% Outcome
    VF --> GD
    GD --> C
```