import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../lib/db";
import { integrationsRepo } from "../repos";
import * as stravaService from "../services/strava";

export const stravaRouter = Router();

const SERVER_REDIRECT_URI =
  process.env["STRAVA_REDIRECT_URI"] ?? "http://localhost:3001/api/strava/callback";
const APP_DEEP_LINK =
  process.env["STRAVA_APP_DEEP_LINK"] ?? "bat-athlete://strava-callback";

stravaRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;

  if (error || !code || !state) {
    return sendDeepLinkPage(res, `${APP_DEEP_LINK}?error=cancelled`);
  }

  try {
    const payload = jwt.verify(state, process.env["JWT_SECRET"] ?? "") as { athleteId: string };
    const tokens = await stravaService.exchangeCode(code, SERVER_REDIRECT_URI);
    await integrationsRepo.upsertStrava(db, { athleteId: payload.athleteId, ...tokens });
    return sendDeepLinkPage(res, `${APP_DEEP_LINK}?success=1`);
  } catch (e) {
    console.error("[Strava callback]", e);
    return sendDeepLinkPage(res, `${APP_DEEP_LINK}?error=failed`);
  }
});

function sendDeepLinkPage(res: import("express").Response, deepLink: string) {
  return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connecting Strava…</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
           background: #070C18; color: #F8FAFC; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 24px; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    p  { font-size: 14px; color: #94A3B8; margin: 0 0 24px; }
    a  { display: inline-block; background: #FC4C02; color: #fff; text-decoration: none;
         padding: 14px 28px; border-radius: 14px; font-weight: 600; font-size: 15px; }
  </style>
</head>
<body>
  <div class="icon">✅</div>
  <h1>Strava Connected!</h1>
  <p>Returning you to Book a Train…</p>
  <a href="${deepLink}">Open Book a Train</a>
  <script>
    setTimeout(function() { window.location.href = "${deepLink}"; }, 300);
  </script>
</body>
</html>`);
}
