const pool = require("../config/database");

exports.listTechnicians = async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM technicians ORDER BY technician_id DESC");
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.createTechnician = async (req, res, next) => {
  try {
    const { name, phone, email, skills } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });
    const [result] = await pool.execute(
      "INSERT INTO technicians (name, phone, email, skills) VALUES (?, ?, ?, ?)",
      [name, phone ?? null, email ?? null, skills ?? null]
    );
    res.status(201).json({ success: true, technician_id: result.insertId });
  } catch (error) { next(error); }
};
