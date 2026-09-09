import type { Profile } from "next-auth";
import type { OIDCConfig } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import WorkOS from "next-auth/providers/workos";

export const GitHubProvider = GitHub({
  allowDangerousEmailAccountLinking: true,
});

export const GoogleProvider = Google({
  allowDangerousEmailAccountLinking: true,
  authorization: {
    params: {
      // See https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
      prompt: "select_account",
      // scope:
      //   "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    },
  },
});

export const OIDCProvider: OIDCConfig<Profile> = {
  id: "oidc",
  name: process.env.AUTH_OIDC_NAME ?? "SSO",
  type: "oidc",
  issuer: process.env.AUTH_OIDC_ISSUER,
  clientId: process.env.AUTH_OIDC_ID,
  clientSecret: process.env.AUTH_OIDC_SECRET,
  checks: ["pkce", "state"],
};

// The stock provider bakes an empty `connection=` into the authorize URL, and
// WorkOS requires exactly one of connection/organization/provider — so the
// empty one collides with the per-request `organization` we pass at signIn.
export const WorkOSProvider = WorkOS({
  clientId: process.env.AUTH_WORKOS_ID,
  clientSecret: process.env.AUTH_WORKOS_SECRET,
  authorization: { url: "https://api.workos.com/sso/authorize", params: {} },
  allowDangerousEmailAccountLinking: true,
});

/**
 * Mart Studios / PauliStar fork: self-host magic links must actually send via
 * Resend (upstream forces apiKey:undefined + stdout-only for local/dev).
 * EMAIL_FROM defaults to verified Mart domain; stdout log kept as ops fallback.
 */
export const ResendProvider = Resend({
  apiKey: process.env.RESEND_API_KEY,
  from:
    process.env.EMAIL_FROM ??
    "OpenStatus <noreply@martstudiosbr.com>",
  async sendVerificationRequest(params) {
    const { identifier, provider, url } = params;
    const { host } = new URL(url);

    console.log("");
    console.log(`>>> Magic Link: ${url}`);
    console.log("");

    if (!provider.apiKey) {
      throw new Error(
        "RESEND_API_KEY is required to send OpenStatus magic-link emails",
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from,
        to: identifier,
        subject: `Sign in to ${host}`,
        html: `<body style="background:#f9f9f9;font-family:sans-serif"><table width="100%" border="0" cellspacing="20" cellpadding="0" style="max-width:600px;margin:auto;background:#fff"><tr><td align="center" style="padding:10px 0px"><strong style="font-size:22px">Sign in to ${host}</strong></td></tr><tr><td align="center"><table border="0" cellspacing="0" cellpadding="0"><tr><td align="center" style="border-radius:5px" bgcolor="#346df1"><a href="${url}" target="_blank" style="font-size:18px;color:#fff;text-decoration:none;border-radius:5px;padding:10px 20px;border:1px solid #346df1;display:inline-block;font-weight:bold">Sign in</a></td></tr></table></td></tr><tr><td align="center" style="padding:0px 0px 10px 0px;font-size:16px;line-height:22px;color:#444">Button not working? Paste this URL into your browser:<br/><a href="${url}" style="color:#346df1">${url}</a></td></tr><tr><td align="center" style="padding:0px 20px 10px 20px;font-size:14px;line-height:22px;color:#444">If you did not request this email you can safely ignore it.</td></tr></table></body>`,
        text: `Sign in to ${host}\n${url}\n\n`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Resend error: ${JSON.stringify(await res.json())}`);
    }
  },
});
