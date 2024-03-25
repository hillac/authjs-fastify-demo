import fastify from "fastify";
import { Session, User } from "@auth/core/types";

// declare module "fastify" {
//   interface FastifyReply {
//     user: User;
//   }
// }

declare module "fastify" {
  interface FastifyReply {
    session: Session | null;
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
