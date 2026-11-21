const router = require("express").Router();
const c = require("../controllers/quotationController");
router.get("/", c.listQuotations);
router.get("/:id", c.getQuotation);
router.post("/", c.createQuotation);
module.exports = router;
