import { FastifyAuth, getSession } from "@auth/fastify";
import Fastify from "fastify";
import formbodyParser from "@fastify/formbody";
import GoogleProvider from "@auth/core/providers/google";
import dotenv from "dotenv";

dotenv.config({ path: `.env.local` });

const originalFetch = globalThis.fetch;

function fakeFetch(
  input: RequestInfo | URL,
  init?: RequestInit | undefined
): Promise<Response> {
  if (
    input === "https://accounts.google.com/.well-known/openid-configuration" &&
    init?.method === "GET" &&
    init?.headers &&
    // @ts-expect-error
    init.headers?.get &&
    // @ts-expect-error
    init.headers?.get("accept") === "application/json"
  ) {
    const res = new Response(
      JSON.stringify({
        issuer: "https://accounts.google.com",
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        device_authorization_endpoint:
          "https://oauth2.googleapis.com/device/code",
        token_endpoint: "https://oauth2.googleapis.com/token",
        userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
        revocation_endpoint: "https://oauth2.googleapis.com/revoke",
        jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
        response_types_supported: [
          "code",
          "token",
          "id_token",
          "code token",
          "code id_token",
          "token id_token",
          "code token id_token",
          "none",
        ],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        scopes_supported: ["openid", "email", "profile"],
        token_endpoint_auth_methods_supported: [
          "client_secret_post",
          "client_secret_basic",
        ],
        claims_supported: [
          "aud",
          "email",
          "email_verified",
          "exp",
          "family_name",
          "given_name",
          "iat",
          "iss",
          "name",
          "picture",
          "sub",
        ],
        code_challenge_methods_supported: ["plain", "S256"],
        grant_types_supported: [
          "authorization_code",
          "refresh_token",
          "urn:ietf:params:oauth:grant-type:device_code",
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        ],
      }),
      {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    Object.defineProperty(res, "url", {
      value: input,
      writable: false,
    });
    return Promise.resolve(res);
  }
  return originalFetch(input, init);
}
globalThis.fetch = fakeFetch;

const fastify = Fastify({ logger: true });

const config = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.AUTH_SECRET!,
  trustHost: true,
};

const AuthPlugin = FastifyAuth(config);
fastify.register(formbodyParser);
fastify.register(AuthPlugin, { prefix: "/api/auth" });

fastify.decorate("authenticate", async (req, reply) => {
  const session = await getSession(req, config);
  if (!session) {
    reply.status(403).send("Unauthorized");
    return;
  }
  reply.user = session?.user; // Decorating the reply object
});

fastify.get(
  "/api/users/me",
  { preHandler: [fastify.authenticate] },
  async (req, reply) => {
    reply.type("text/html").send(
      `
        <h1>Profile</h1>
        <pre>${JSON.stringify(reply.user?.name, null, 2)}</pre>
        <a href="/">Home</a>
    `
    );
  }
);

fastify.get("/", (req, reply) => {
  reply.type("text/html").send(
    `
            <h1>Welcome to Auth.js + Fastify Demo!</h1>
            <ol>
            <li>Sign in at <a href="/api/auth/signin">/api/auth/signin</a> </li>
            <li>Sign out at <a href="/api/auth/signout">/api/auth/signout</a> </li>
            <li>Access the current user at <a href="/api/users/me">/api/users/me</a> </li>
            </ol>
        `
  );
});

fastify.listen({ port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
