### Location Based Authentication

## Work done so far:

- A client-server framework using Node.js/express following a guide on [MDN Developer Docs](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Express_Nodejs)
- Also added a MongoDB database and created a few object models to be stored on the Database.
- Some flowchart models generated using ChatGPT to visualise the system components and data flow.

## TODO:

# 1. replace the the Mongo DB database with a PostgreSQL one.

- figure out a free way to host a PostgeSQL database online.
- create a user object that consists of: id, username, password (bare minimum for test purposes now)

# 2. Create a page:

- must accept two values: username and password
- store them on an object called user
- request the data to be sent to the database
- receive a message saying "user with username created"

Once the data transfer is set up and working, next steps to think about:

- Implementing JWT for session management
- Look int OAuth for authentication features
- Add main page (for mobile version add a QR code scanner)
- build front page and registration page with React Native for mobile
- Look int Google location API and how to implement it.

P.S. all of these tasks need to be broken down into manageble steps.
