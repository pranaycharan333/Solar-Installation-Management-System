const pool = require("../config/database");

exports.listProjects = async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM projects ORDER BY project_id DESC");
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.getProject = async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM projects WHERE project_id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Project not found" });
    res.json({ success: true, data: rows[0] });
  } catch (error) { next(error); }
};

exports.createProject = async (req, res, next) => {
  try {
    const { customer_id, project_name, system_capacity_kw, system_type, status } = req.body;
    if (!customer_id || !project_name) return res.status(400).json({ success: false, message: "customer_id and project_name are required" });
    const [result] = await pool.execute(
      "INSERT INTO projects (customer_id, project_name, system_capacity_kw, system_type, status) VALUES (?, ?, ?, ?, ?)",
      [customer_id, project_name, system_capacity_kw ?? null, system_type ?? null, status ?? "enquiry"]
    );
    res.status(201).json({ success: true, project_id: result.insertId });
  } catch (error) { next(error); }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { project_name, system_capacity_kw, system_type, status } = req.body;
    const [result] = await pool.execute(
      "UPDATE projects SET project_name = ?, system_capacity_kw = ?, system_type = ?, status = ? WHERE project_id = ?",
      [project_name, system_capacity_kw ?? null, system_type ?? null, status ?? null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Project not found" });
    res.json({ success: true, message: "Project updated" });
  } catch (error) { next(error); }
};
