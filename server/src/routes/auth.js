import { Router } from 'express';
import { User } from '../models.js';
import { parse, signToken } from '../http.js';
import { schemas } from '../schemas.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import { seedCategories } from '../services/cycles.js';
import { requireAuth } from '../http.js';

const router = Router();

router.post('/google', async (req, res) => {
  const { idToken } = parse(schemas.googleLogin, req.body);
  // Profile fields come from Google's verified payload, never from the client.
  const profile = await verifyGoogleIdToken(idToken);
  let user = await User.findOne({ googleId: profile.googleId });
  if (user) {
    Object.assign(user, { name: profile.name, email: profile.email, picture: profile.picture });
    await user.save();
  } else {
    user = await User.create(profile);
    await seedCategories(user._id);
  }
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, today: req.today });
});

export default router;
