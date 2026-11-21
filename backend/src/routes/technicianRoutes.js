const router = require("express").Router();
const c = require("../controllers/technicianController");
router.get("/", c.listTechnicians);
router.post("/", c.createTechnician);
module.exports = router;
