const express = require("express");

const router = express.Router();

/* GET users listing. */
router.get("/", (req, res, next) => {
  res.send("respond with a resource");
});

router.get("./cool", (req, res, next) => {
  res.send("Youre so cool");
});

module.exports = router;
