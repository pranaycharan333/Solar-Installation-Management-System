# Database

The PostgreSQL schema lives in `schema.prisma`. Backend database commands use this file through the schema path configured in `backend/package.json`.

From the `backend` directory:

- `npm run db:generate` regenerates the Prisma client from the schema.
- `npm run db:push` applies schema changes to the configured database. Review schema changes before running it against a database with data.

Connection strings and credentials belong in the private `backend/.env` file. Never commit that file.
