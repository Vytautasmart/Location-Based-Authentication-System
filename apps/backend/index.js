// node.js version v16.20.2
const express = require("express")();
const app = express();

// Pasre JSON bodies
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.status(200).send({
    message: "Backend is running",
    extrainfo:
      "This is the backend server for the Location-Based Authentication System.",
  });
});

app.post("/page", (req, res) => {
  const data = req.body || {};
  res.status(201).send({
    message: "Data received successfully",
    received: data,
  });
});
