const pool = require("../config/database");

exports.listServiceTickets = async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM service_tickets ORDER BY ticket_id DESC");
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
};

exports.createServiceTicket = async (req, res, next) => {
  try {
    const { customer_id, installation_id, issue_description, priority } = req.body;
    if (!customer_id || !issue_description) {
      return res.status(400).json({ success: false, message: "customer_id and issue_description are required" });
    }
    const [result] = await pool.execute(
      "INSERT INTO service_tickets (customer_id, installation_id, issue_description, priority, status) VALUES (?, ?, ?, ?, ?)",
      [customer_id, installation_id ?? null, issue_description, priority ?? "normal", "open"]
    );
    res.status(201).json({ success: true, ticket_id: result.insertId });
  } catch (error) { next(error); }
};

exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });
    const [result] = await pool.execute(
      "UPDATE service_tickets SET status = ? WHERE ticket_id = ?",
      [status, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Ticket not found" });
    res.json({ success: true, message: "Ticket status updated" });
  } catch (error) { next(error); }
};
