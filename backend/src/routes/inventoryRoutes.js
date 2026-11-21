const router = require("express").Router();
const c = require("../controllers/inventoryController");
router.get("/materials", c.listMaterials);
router.get("/:materialId", c.getInventory);
router.post("/adjust", c.adjustStock);
module.exports = router;
