const router = require("express").Router();
const c = require("../controllers/customerController");
router.get("/", c.listCustomers);
router.get("/:id", c.getCustomer);
router.post("/", c.createCustomer);
router.put("/:id", c.updateCustomer);
router.delete("/:id", c.deleteCustomer);
module.exports = router;
