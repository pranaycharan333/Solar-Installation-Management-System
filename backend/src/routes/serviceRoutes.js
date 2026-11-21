const router = require("express").Router();
const c = require("../controllers/serviceController");
router.get("/", c.listServiceTickets);
router.post("/", c.createServiceTicket);
router.patch("/:id/status", c.updateTicketStatus);
module.exports = router;
