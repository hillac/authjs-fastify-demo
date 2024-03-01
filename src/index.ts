import { FastifyAuth, getSession } from "@auth/fastify";
import Fastify from "fastify";
import formbodyParser from "@fastify/formbody";
import GoogleProvider from "@auth/core/providers/google";
import dotenv from "dotenv";

dotenv.config({ path: `.env.local` });

const originalFetch = globalThis.fetch;
const cache = new Map<string, Response>();

async function cacheOpenidFetch(
  input: RequestInfo | URL,
  init?: RequestInit | undefined
): Promise<Response> {
  // cache the response of the openid-configuration by url
  const strInput = input.toString();
  if (strInput.includes("/.well-known/openid-configuration")) {
    // Check if response is in cache
    if (cache.has(strInput)) {
      return cache.get(strInput)!.clone();
    }

    // If not in cache, fetch and store in cache
    let attempts = 0;
    while (attempts < 3) {
      try {
        const response = await originalFetch(input, init);
        cache.set(strInput, response.clone());
        return response;
      } catch (error) {
        attempts++;
        console.log(`Attempt ${attempts} failed for ${strInput}. Retrying...`);
        if (attempts >= 3) throw error;
      }
    }
  }
  // normal fetch
  return originalFetch(input, init);
}

globalThis.fetch = cacheOpenidFetch;

const fastify = Fastify({ logger: true });

const config = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
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
