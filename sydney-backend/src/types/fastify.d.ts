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
        avatar?: number | null;
      };
      session: unknown;
    };
  }
}
