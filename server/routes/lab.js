const express = require("express");
const path = require("node:path");

const router = express.Router();
const FILES = {
  "linknest.dtd": path.join(__dirname, "..", "schemas", "linknest.dtd"),
  "linknest.xsd": path.join(__dirname, "..", "schemas", "linknest.xsd"),
  "sample.xml": path.join(__dirname, "..", "labs", "sample-linknest.xml"),
};

for (const [name, file] of Object.entries(FILES)) {
  router.get(`/${name}`, (_req, res) => res.sendFile(file, { headers: { "Cache-Control": "public, max-age=300" } }));
}

module.exports = router;
