import fastify from "fastify";
import { User } from "@auth/core/types";

declare module "fastify" {
  interface FastifyReply {
    user: User;
  }
}

declare module "fastify" {
  export interface FastifyInstance<
    HttpServer = Server,
    HttpRequest = IncomingMessage,
    HttpResponse = ServerResponse
  > {
    authenticate: (req, reply) => void;
  }
}
