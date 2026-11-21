const router = require("express").Router();
const c = require("../controllers/projectController");
router.get("/", c.listProjects);
router.get("/:id", c.getProject);
router.post("/", c.createProject);
router.put("/:id", c.updateProject);
module.exports = router;
