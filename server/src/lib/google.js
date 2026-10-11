import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { ApiError } from '../http.js';

let client;

/** Verifies a Google ID token with Google (signature, expiry, audience). Returns the payload. */
export async function verifyGoogleIdToken(idToken) {
  if (!config.googleClientId) {
    throw new ApiError(500, 'CONFIG', 'GOOGLE_CLIENT_ID is not configured on the server');
  }
  client ??= new OAuth2Client(config.googleClientId);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
    const p = ticket.getPayload();
    if (!p?.sub) throw new Error('no sub');
    if (p.email && p.email_verified === false) throw new Error('email not verified');
    return { googleId: p.sub, name: p.name ?? '', email: p.email ?? '', picture: p.picture ?? '' };
  } catch {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in could not be verified');
  }
}
