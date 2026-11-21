# SolarOps additional backend files

This archive contains additional route, controller, middleware, seed-template,
and environment-example files. It does not replace your existing schema.sql,
database.js, server.js, package.json, package-lock.json, .env, or .gitignore.

## Important schema compatibility warning

The controllers use assumed MySQL table/column names:
- customers(customer_id, name, phone, email, address)
- projects(project_id, customer_id, project_name, system_capacity_kw, system_type, status)
- materials(material_id)
- inventory(material_id, quantity_on_hand)
- quotations(quotation_id, project_id, quotation_number, total_amount, status)
- technicians(technician_id, name, phone, email, skills)
- service_tickets(ticket_id, customer_id, installation_id, issue_description, priority, status)

Your existing schema must contain these exact tables and columns for these example endpoints to run.
Your screenshot shows an `enquiries` table and `roof_surveys`; that is not enough to confirm compatibility.
Review and adapt SQL identifiers to the actual schema before running. Do not execute seed.sql until it contains schema-matched data.

## Install and integrate

1. Copy the folders/files into the existing backend folder, merging folders rather than replacing existing files.
2. Keep your existing .env private. Create .env from .env.example only if needed.
3. Ensure database.js exports a mysql2/promise connection pool as `module.exports = pool`.
4. Ensure server.js mounts the routers and error handler, for example:
   - app.use('/api/customers', require('./routes/customerRoutes'))
   - app.use('/api/projects', require('./routes/projectRoutes'))
   - app.use('/api/inventory', require('./routes/inventoryRoutes'))
   - app.use('/api/quotations', require('./routes/quotationRoutes'))
   - app.use('/api/technicians', require('./routes/technicianRoutes'))
   - app.use('/api/service-tickets', require('./routes/serviceRoutes'))
   - app.use(errorHandler) after routes
5. Add authentication middleware to protected routes after agreeing the auth strategy with the team.
6. Test each endpoint against a local development database before pushing.

## Dependencies

These files use express, mysql2 and jsonwebtoken, which are already listed in the current backend package.json.
