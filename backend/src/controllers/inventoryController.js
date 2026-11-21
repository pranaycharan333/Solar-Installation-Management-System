const pool = require("../config/database");

exports.listMaterials = async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM materials ORDER BY material_id DESC");
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.getInventory = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM inventory WHERE material_id = ?",
      [req.params.materialId]
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.adjustStock = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { material_id, quantity_change, reason } = req.body;
    if (!material_id || !Number.isInteger(quantity_change) || !reason) {
      return res.status(400).json({ success: false, message: "material_id, integer quantity_change and reason are required" });
    }
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT * FROM inventory WHERE material_id = ? FOR UPDATE",
      [material_id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Inventory record not found" });
    }
    const current = Number(rows[0].quantity_on_hand);
    const next = current + quantity_change;
    if (next < 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: "Insufficient stock" });
    }
    await connection.execute(
      "UPDATE inventory SET quantity_on_hand = ? WHERE material_id = ?",
      [next, material_id]
    );
    await connection.commit();
    res.json({ success: true, material_id, quantity_on_hand: next, reason });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
};
