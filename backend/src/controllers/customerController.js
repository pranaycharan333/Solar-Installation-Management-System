const pool = require("../config/database");

exports.listCustomers = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM customers ORDER BY customer_id DESC"
    );
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM customers WHERE customer_id = ?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, data: rows[0] });
  } catch (error) { next(error); }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });
    const [result] = await pool.execute(
      "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
      [name, phone ?? null, email ?? null, address ?? null]
    );
    res.status(201).json({ success: true, customer_id: result.insertId });
  } catch (error) { next(error); }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address } = req.body;
    const [result] = await pool.execute(
      "UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE customer_id = ?",
      [name, phone ?? null, email ?? null, address ?? null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, message: "Customer updated" });
  } catch (error) { next(error); }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const [result] = await pool.execute("DELETE FROM customers WHERE customer_id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, message: "Customer deleted" });
  } catch (error) { next(error); }
};
