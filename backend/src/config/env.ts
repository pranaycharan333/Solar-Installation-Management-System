export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required. Set it in the backend environment before starting the server.');
  }
  return secret;
}
