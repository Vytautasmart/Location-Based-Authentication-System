``` mermaid
flowchart TB
    %% Entry
    START([App Launch])
    HOME{Authenticated?}

    %% Screens
    LOGIN[Login Screen<br/>Email/Password, Forgot password, Socials]
    REGISTER[Register Screen<br/>Name, Email, Password, T&Cs]
    SCAN[Scan QR Screen<br/>Camera preview + helper text]

    %% Login flow
    SUBMIT_LOGIN[Validate inputs<br/>client-side]
    AUTH{Credentials valid?}
    LOGIN_ERR[[Show error<br/>inline/toast]]

    %% Register flow
    SUBMIT_REG[Validate inputs<br/>client-side]
    CREATE{Account created?}
    REG_ERR[[Show error<br/>inline/toast]]

    %% Scan flow
    PERM{Camera permission granted?}
    ASK_PERM[[Request permission]]
    PERM_DENY[[Explain why needed + link to Settings]]
    QR{QR code valid?}
    QR_ERR[[Show invalid/expired QR]]

    %% Destinations
    DASH[Home/Dashboard]
    ACTION[QR action success<br/>e.g., join session, open link]

    %% Entry routing
    START --> HOME
    HOME -- Yes --> DASH
    HOME -- No --> LOGIN

    %% Login screen nav
    LOGIN --> SUBMIT_LOGIN --> AUTH
    AUTH -- Yes --> DASH
    AUTH -- No --> LOGIN_ERR --> LOGIN
    LOGIN -- New user --> REGISTER

    %% Register screen nav
    REGISTER --> SUBMIT_REG --> CREATE
    CREATE -- Yes --> DASH
    CREATE -- No --> REG_ERR --> REGISTER
    REGISTER -- Have an account --> LOGIN

    %% From Dashboard to Scan
    DASH --> SCAN

    %% Scan QR flow
    SCAN --> PERM
    PERM -- No --> ASK_PERM --> PERM
    PERM -- Still denied --> PERM_DENY --> SCAN
    PERM -- Yes --> QR
    QR -- Valid --> ACTION --> DASH
    QR -- Invalid/expired --> QR_ERR --> SCAN
```