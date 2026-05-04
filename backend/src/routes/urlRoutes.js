const express = require("express");

const { redirectToOriginal } = require("../controllers/urlController");

const router = express.Router();

router.get("/:shortCode", redirectToOriginal);

module.exports = router;
