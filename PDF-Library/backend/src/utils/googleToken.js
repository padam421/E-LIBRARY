async function verifyAccessTokenAudience(token) {
  const expectedClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!expectedClientId) return;

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  );

  if (!response.ok) {
    const error = new Error("Google token validation failed.");
    error.statusCode = 401;
    throw error;
  }

  const tokenInfo = await response.json();
  const audience = String(tokenInfo?.aud || "").trim();
  if (audience !== expectedClientId) {
    const error = new Error("Google token was not issued for this website.");
    error.statusCode = 401;
    throw error;
  }
}

export async function verifyGoogleAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) {
    const error = new Error("Google access token is missing.");
    error.statusCode = 401;
    throw error;
  }

  await verifyAccessTokenAudience(token);

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = new Error("Google user info request failed.");
    error.statusCode = 401;
    throw error;
  }

  const profile = await response.json();
  if (!profile?.email || profile.email_verified === false) {
    const error = new Error("Google account email is missing or unverified.");
    error.statusCode = 401;
    throw error;
  }

  return {
    email: String(profile.email).trim().toLowerCase(),
    name: String(profile.name || profile.email || "User").trim(),
    picture: String(profile.picture || "").trim(),
    given_name: String(profile.given_name || "").trim(),
    sub: String(profile.sub || "").trim(),
  };
}
