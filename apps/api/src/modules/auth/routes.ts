import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { OAuthProvider, AuthUser } from '@oauth-service/shared-types';

interface OAuthProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  rawProfile: Record<string, unknown>;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function getOAuthApp(db: FastifyInstance['db'], provider: OAuthProvider) {
  const [app] = await db`
    SELECT client_id, client_secret, scopes, callback_url, enabled
    FROM oauth_apps WHERE provider = ${provider}
  `;
  return app;
}

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Rate limit auth routes more strictly
  fastify.addHook('onRequest', async (request, reply) => {
    // Additional rate limiting could be added here
  });

  // Initiate OAuth flow
  fastify.get<{ Params: { provider: OAuthProvider } }>(
    '/:provider',
    async (request, reply) => {
      const { provider } = request.params;

      if (!['google', 'github'].includes(provider)) {
        return reply.status(400).send({ error: 'Invalid provider' });
      }

      const app = await getOAuthApp(fastify.db, provider);
      if (!app || !app.enabled) {
        return reply.status(400).send({ error: 'Provider not configured' });
      }

      const clientSecret = fastify.encryption.decrypt(app.client_secret);
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Store state and verifier in signed cookie
      const oauthState = JSON.stringify({ state, codeVerifier, provider });
      reply.setCookie('__oauth_state', oauthState, {
        httpOnly: true,
        secure: fastify.config.isProduction,
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
        signed: true,
      });

      let authUrl: string;

      if (provider === 'google') {
        const params = new URLSearchParams({
          client_id: app.client_id,
          redirect_uri: app.callback_url,
          response_type: 'code',
          scope: app.scopes.join(' '),
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
        });
        authUrl = `${GOOGLE_AUTH_URL}?${params}`;
      } else {
        const params = new URLSearchParams({
          client_id: app.client_id,
          redirect_uri: app.callback_url,
          scope: app.scopes.join(' '),
          state,
        });
        authUrl = `${GITHUB_AUTH_URL}?${params}`;
      }

      fastify.audit.logFromRequest(request, {
        eventType: 'oauth_initiated',
        provider,
      });

      return reply.redirect(authUrl);
    }
  );

  // OAuth callback
  fastify.get<{
    Params: { provider: OAuthProvider };
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    '/:provider/callback',
    async (request, reply) => {
      const { provider } = request.params;
      const { code, state, error } = request.query;

      if (error) {
        fastify.audit.logFromRequest(request, {
          eventType: 'oauth_callback_failure',
          provider,
          metadata: { error },
        });
        return reply.redirect(`${fastify.config.urls.web}/login?error=${error}`);
      }

      if (!code || !state) {
        return reply.redirect(`${fastify.config.urls.web}/login?error=missing_params`);
      }

      // Verify state
      const stateCookie = request.cookies.__oauth_state;
      if (!stateCookie) {
        return reply.redirect(`${fastify.config.urls.web}/login?error=invalid_state`);
      }

      let storedState: { state: string; codeVerifier: string; provider: string };
      try {
        const unsigned = request.unsignCookie(stateCookie);
        if (!unsigned.valid || !unsigned.value) {
          throw new Error('Invalid cookie signature');
        }
        storedState = JSON.parse(unsigned.value);
      } catch {
        return reply.redirect(`${fastify.config.urls.web}/login?error=invalid_state`);
      }

      if (storedState.state !== state || storedState.provider !== provider) {
        return reply.redirect(`${fastify.config.urls.web}/login?error=state_mismatch`);
      }

      // Clear state cookie
      reply.clearCookie('__oauth_state', { path: '/' });

      const app = await getOAuthApp(fastify.db, provider);
      if (!app) {
        return reply.redirect(`${fastify.config.urls.web}/login?error=provider_error`);
      }

      const clientSecret = fastify.encryption.decrypt(app.client_secret);

      // Exchange code for tokens
      let tokens: OAuthTokens;
      let profile: OAuthProfile;

      try {
        if (provider === 'google') {
          const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: app.client_id,
              client_secret: clientSecret,
              code,
              redirect_uri: app.callback_url,
              grant_type: 'authorization_code',
              code_verifier: storedState.codeVerifier,
            }),
          });

          const tokenData = await tokenResponse.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in?: number;
          };

          tokens = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in 
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : undefined,
          };

          const userResponse = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          const userData = await userResponse.json() as {
            sub: string;
            email: string;
            email_verified: boolean;
            name: string;
            picture: string;
          };

          profile = {
            id: userData.sub,
            email: userData.email,
            emailVerified: userData.email_verified,
            name: userData.name,
            avatarUrl: userData.picture,
            rawProfile: userData,
          };
        } else {
          // GitHub
          const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
            },
            body: new URLSearchParams({
              client_id: app.client_id,
              client_secret: clientSecret,
              code,
              redirect_uri: app.callback_url,
            }),
          });

          const tokenData = await tokenResponse.json() as {
            access_token: string;
            refresh_token?: string;
          };

          tokens = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
          };

          const userResponse = await fetch(GITHUB_USER_URL, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          const userData = await userResponse.json() as {
            id: number;
            login: string;
            name: string;
            avatar_url: string;
            email: string | null;
          };

          // Get primary email if not public
          let email = userData.email;
          let emailVerified = false;

          if (!email) {
            const emailsResponse = await fetch(GITHUB_EMAILS_URL, {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            const emails = await emailsResponse.json() as Array<{
              email: string;
              primary: boolean;
              verified: boolean;
            }>;
            const primary = emails.find((e) => e.primary && e.verified);
            if (primary) {
              email = primary.email;
              emailVerified = primary.verified;
            }
          }

          if (!email) {
            return reply.redirect(`${fastify.config.urls.web}/login?error=no_email`);
          }

          profile = {
            id: String(userData.id),
            email,
            emailVerified,
            name: userData.name || userData.login,
            avatarUrl: userData.avatar_url,
            rawProfile: userData,
          };
        }
      } catch (err) {
        fastify.log.error({ err, provider }, 'OAuth token exchange failed');
        fastify.audit.logFromRequest(request, {
          eventType: 'oauth_callback_failure',
          provider,
          metadata: { error: 'token_exchange_failed' },
        });
        return reply.redirect(`${fastify.config.urls.web}/login?error=auth_failed`);
      }

      // Account linking logic
      let user: AuthUser | null = null;
      let isNewUser = false;

      // 1. Check if oauth_connection exists
      const [existingConnection] = await fastify.db`
        SELECT user_id FROM oauth_connections
        WHERE provider = ${provider} AND provider_uid = ${profile.id}
      `;

      if (existingConnection) {
        // Log in existing user
        const [existingUser] = await fastify.db<AuthUser[]>`
          SELECT id, email, email_verified as "emailVerified", name, 
            avatar_url as "avatarUrl", is_admin as "isAdmin",
            profile_complete as "profileComplete",
            created_at as "createdAt", last_login_at as "lastLoginAt"
          FROM users WHERE id = ${existingConnection.user_id}
        `;
        user = existingUser;

        // Update tokens
        await fastify.db`
          UPDATE oauth_connections SET
            access_token = ${fastify.encryption.encrypt(tokens.accessToken)},
            refresh_token = ${tokens.refreshToken ? fastify.encryption.encrypt(tokens.refreshToken) : null},
            token_expires_at = ${tokens.expiresAt ?? null},
            raw_profile = ${JSON.stringify(profile.rawProfile)}::jsonb
          WHERE provider = ${provider} AND provider_uid = ${profile.id}
        `;
      } else {
        // 2. Check if user with this email exists (for auto-linking)
        const [existingUserByEmail] = await fastify.db<AuthUser[]>`
          SELECT id, email, email_verified as "emailVerified", name, 
            avatar_url as "avatarUrl", is_admin as "isAdmin",
            profile_complete as "profileComplete",
            created_at as "createdAt", last_login_at as "lastLoginAt"
          FROM users WHERE email = ${profile.email}
        `;

        if (existingUserByEmail && profile.emailVerified) {
          // Auto-link provider to existing user
          user = existingUserByEmail;

          await fastify.db`
            INSERT INTO oauth_connections 
              (user_id, provider, provider_uid, email, access_token, refresh_token, token_expires_at, raw_profile)
            VALUES (
              ${user.id}, ${provider}, ${profile.id}, ${profile.email},
              ${fastify.encryption.encrypt(tokens.accessToken)},
              ${tokens.refreshToken ? fastify.encryption.encrypt(tokens.refreshToken) : null},
              ${tokens.expiresAt ?? null},
              ${JSON.stringify(profile.rawProfile)}::jsonb
            )
          `;

          fastify.audit.logFromRequest(request, {
            userId: user.id,
            eventType: 'account_linked',
            provider,
          });
        } else {
          // 3. Create new user
          isNewUser = true;

          const [newUser] = await fastify.db<AuthUser[]>`
            INSERT INTO users (email, email_verified, name, avatar_url, profile_complete)
            VALUES (${profile.email}, ${profile.emailVerified}, ${profile.name}, ${profile.avatarUrl}, false)
            RETURNING 
              id, email, email_verified as "emailVerified", name, 
              avatar_url as "avatarUrl", is_admin as "isAdmin",
              profile_complete as "profileComplete",
              created_at as "createdAt", last_login_at as "lastLoginAt"
          `;
          user = newUser;

          await fastify.db`
            INSERT INTO oauth_connections 
              (user_id, provider, provider_uid, email, access_token, refresh_token, token_expires_at, raw_profile)
            VALUES (
              ${user.id}, ${provider}, ${profile.id}, ${profile.email},
              ${fastify.encryption.encrypt(tokens.accessToken)},
              ${tokens.refreshToken ? fastify.encryption.encrypt(tokens.refreshToken) : null},
              ${tokens.expiresAt ?? null},
              ${JSON.stringify(profile.rawProfile)}::jsonb
            )
          `;
        }
      }

      if (!user) {
        return reply.redirect(`${fastify.config.urls.web}/login?error=user_error`);
      }

      // Update last login
      await fastify.db`
        UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}
      `;

      // Create session (refresh token)
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const familyId = crypto.randomUUID();
      const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await fastify.db`
        INSERT INTO sessions (user_id, refresh_token_hash, family_id, expires_at, ip_address, user_agent)
        VALUES (
          ${user.id}, ${refreshTokenHash}, ${familyId}, ${refreshExpiresAt},
          ${request.ip}::inet, ${request.headers['user-agent'] ?? null}
        )
      `;

      // Create access token (JWT)
      const accessToken = fastify.jwt.sign(
        { userId: user.id, email: user.email, isAdmin: user.isAdmin },
        { expiresIn: fastify.config.jwt.expiresIn }
      );

      // Set cookies
      reply.setCookie('__access', accessToken, {
        httpOnly: true,
        secure: fastify.config.isProduction,
        sameSite: 'lax',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });

      reply.setCookie('__refresh', refreshToken, {
        httpOnly: true,
        secure: fastify.config.isProduction,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      fastify.audit.logFromRequest(request, {
        userId: user.id,
        eventType: 'login',
        provider,
        metadata: { isNewUser },
      });

      // Redirect to app or profile setup
      const redirectUrl = isNewUser || !user.profileComplete
        ? `${fastify.config.urls.web}/profile-setup`
        : fastify.config.urls.web;

      return reply.redirect(redirectUrl);
    }
  );

  // Token refresh
  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.__refresh;

    if (!refreshToken) {
      return reply.status(401).send({ error: 'No refresh token' });
    }

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Find session
    const [session] = await fastify.db`
      SELECT id, user_id, family_id, revoked_at, expires_at
      FROM sessions
      WHERE refresh_token_hash = ${refreshTokenHash}
    `;

    if (!session) {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    // Check if token was revoked (replay detection)
    if (session.revoked_at) {
      // Revoke entire family
      await fastify.db`
        UPDATE sessions SET revoked_at = NOW()
        WHERE family_id = ${session.family_id} AND revoked_at IS NULL
      `;

      fastify.audit.logFromRequest(request, {
        userId: session.user_id,
        eventType: 'token_replay_detected',
        metadata: { familyId: session.family_id },
      });

      reply.clearCookie('__access', { path: '/' });
      reply.clearCookie('__refresh', { path: '/' });

      return reply.status(401).send({ error: 'Token reuse detected' });
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      return reply.status(401).send({ error: 'Refresh token expired' });
    }

    // Revoke old token
    await fastify.db`
      UPDATE sessions SET revoked_at = NOW(), rotated_at = NOW()
      WHERE id = ${session.id}
    `;

    // Get user
    const [user] = await fastify.db<AuthUser[]>`
      SELECT id, email, is_admin as "isAdmin"
      FROM users WHERE id = ${session.user_id}
    `;

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    // Create new session (rotation)
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await fastify.db`
      INSERT INTO sessions (user_id, refresh_token_hash, family_id, expires_at, ip_address, user_agent)
      VALUES (
        ${user.id}, ${newRefreshTokenHash}, ${session.family_id}, ${newExpiresAt},
        ${request.ip}::inet, ${request.headers['user-agent'] ?? null}
      )
    `;

    // Create new access token
    const accessToken = fastify.jwt.sign(
      { userId: user.id, email: user.email, isAdmin: user.isAdmin },
      { expiresIn: fastify.config.jwt.expiresIn }
    );

    reply.setCookie('__access', accessToken, {
      httpOnly: true,
      secure: fastify.config.isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });

    reply.setCookie('__refresh', newRefreshToken, {
      httpOnly: true,
      secure: fastify.config.isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    fastify.audit.logFromRequest(request, {
      userId: user.id,
      eventType: 'token_refreshed',
    });

    return { success: true };
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    const refreshToken = request.cookies.__refresh;

    if (refreshToken) {
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      // Get session for audit
      const [session] = await fastify.db`
        SELECT user_id FROM sessions WHERE refresh_token_hash = ${refreshTokenHash}
      `;

      // Revoke token
      await fastify.db`
        UPDATE sessions SET revoked_at = NOW()
        WHERE refresh_token_hash = ${refreshTokenHash}
      `;

      if (session) {
        fastify.audit.logFromRequest(request, {
          userId: session.user_id,
          eventType: 'logout',
        });
      }
    }

    reply.clearCookie('__access', { path: '/' });
    reply.clearCookie('__refresh', { path: '/' });

    return { success: true };
  });

  // Get session
  fastify.get('/session', async (request, reply) => {
    const token = request.cookies.__access;

    if (!token) {
      return { authenticated: false };
    }

    try {
      const decoded = fastify.jwt.verify<{ userId: string }>(token);

      const [user] = await fastify.db<AuthUser[]>`
        SELECT 
          id, email, email_verified as "emailVerified", name, 
          avatar_url as "avatarUrl", is_admin as "isAdmin",
          profile_complete as "profileComplete",
          created_at as "createdAt", last_login_at as "lastLoginAt"
        FROM users WHERE id = ${decoded.userId}
      `;

      if (!user) {
        return { authenticated: false };
      }

      return {
        authenticated: true,
        user,
        needsProfileSetup: !user.profileComplete,
      };
    } catch {
      return { authenticated: false };
    }
  });
}
