import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      userId: string;
      user: {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
      };
      session: unknown;
    };
  }
}
