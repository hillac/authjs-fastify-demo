import { FastifyAuth } from "@auth/fastify";
import formbodyParser from "@fastify/formbody";
import Google from "@auth/fastify/providers/google";
import Fastify, {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import dotenv from "dotenv";

dotenv.config({ path: `.env.local` });
// If app is served through a proxy, trust the proxy to allow HTTPS protocol to be detected
const fastify = Fastify({ trustProxy: true });
// Make sure to use a form body parser so Auth.js can receive data from the client
fastify.register(formbodyParser);
fastify.register(FastifyAuth({ providers: [Google] }), { prefix: "/auth" });

const authConfig = { providers: [Google] };

import { getSession } from "@auth/fastify";

fastify.decorateReply("session", null);

export async function authSession(req: FastifyRequest, reply: FastifyReply) {
  reply.session = await getSession(req, authConfig);
}

fastify.addHook("preHandler", authSession);

import pug from "pug";
import pointOfView from "@fastify/view";
fastify.register(pointOfView, {
  engine: {
    pug,
  },
});

fastify.get("/", (req, reply) => {
  reply.view("/src/index.pug", {
    user: reply.session?.user ?? { name: "none", id: "0" },
  });
});

export async function authenticatedUser(
  req: FastifyRequest,
  reply: FastifyReply
) {
  reply.session ??= await getSession(req, authConfig);
  if (!reply.session?.user) {
    reply.redirect("/auth/signin?error=SessionRequired");
  }
}

// This route is protected
fastify.get("/profile", { preHandler: [authenticatedUser] }, (req, reply) => {
  const session = reply.session;
  reply.view("/src/profile.pug", { user: session?.user });
});

// // This route is not protected
// fastify.get("/", (req, res) => {
//   res.view("index");
// });

// check no leakage between requests. should be null
fastify.addHook("onRequest", async (req, res) => {
  console.log("onRequest", res.session);
});

fastify.register(
  async (instance) => {
    instance.addHook("preHandler", authenticatedUser) // All routes defined after this will be protected

    instance.get("/", (req, reply) => {
      reply.view("protected.pug");
    })

    instance.get("/user/me", (req, reply) => {
      reply.send(reply.session?.user);
    })
  },
  { prefix: "/protected" }
)

fastify.listen({ port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
