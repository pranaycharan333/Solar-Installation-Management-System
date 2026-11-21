const pool = require("../config/database");

exports.listQuotations = async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM quotations ORDER BY quotation_id DESC");
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.getQuotation = async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM quotations WHERE quotation_id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Quotation not found" });
    res.json({ success: true, data: rows[0] });
  } catch (error) { next(error); }
};

exports.createQuotation = async (req, res, next) => {
  try {
    const { project_id, quotation_number, total_amount, status } = req.body;
    if (!project_id || !quotation_number || total_amount == null) {
      return res.status(400).json({ success: false, message: "project_id, quotation_number and total_amount are required" });
    }
    const [result] = await pool.execute(
      "INSERT INTO quotations (project_id, quotation_number, total_amount, status) VALUES (?, ?, ?, ?)",
      [project_id, quotation_number, total_amount, status ?? "draft"]
    );
    res.status(201).json({ success: true, quotation_id: result.insertId });
  } catch (error) { next(error); }
};
