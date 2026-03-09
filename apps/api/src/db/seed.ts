import { sql } from './index.js';
import crypto from 'node:crypto';
import { config } from '../config/index.js';

function encrypt(plaintext: string): Buffer {
  const key = Buffer.from(config.encryption.key, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

async function seed(): Promise<void> {
  console.log('Seeding database...');

  // Seed OAuth apps with credentials from env
  const oauthApps = [
    {
      provider: 'google',
      clientId: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      scopes: ['openid', 'email', 'profile'],
      callbackUrl: `${config.urls.callback}/google/callback`,
    },
    {
      provider: 'github',
      clientId: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret,
      scopes: ['read:user', 'user:email'],
      callbackUrl: `${config.urls.callback}/github/callback`,
    },
  ];

  for (const app of oauthApps) {
    const encryptedSecret = encrypt(app.clientSecret);

    await sql`
      INSERT INTO oauth_apps (provider, client_id, client_secret, scopes, callback_url)
      VALUES (${app.provider}, ${app.clientId}, ${encryptedSecret}, ${app.scopes}, ${app.callbackUrl})
      ON CONFLICT (provider) 
      DO UPDATE SET 
        client_id = EXCLUDED.client_id,
        client_secret = EXCLUDED.client_secret,
        scopes = EXCLUDED.scopes,
        callback_url = EXCLUDED.callback_url,
        updated_at = NOW()
    `;

    console.log(`  Seeded ${app.provider} OAuth app`);
  }

  // Create a default admin user (optional)
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await sql`
      INSERT INTO users (email, email_verified, is_admin, profile_complete, name)
      VALUES (${adminEmail}, true, true, true, 'Admin')
      ON CONFLICT (email) 
      DO UPDATE SET is_admin = true
    `;
    console.log(`  Created admin user: ${adminEmail}`);
  }

  console.log('Seeding complete!');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
