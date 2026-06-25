import type { FastifyInstance, FastifyReply } from "fastify";
import { isUuid } from "../api/ids.js";
import { pool } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { googleAccessToken, uploadFileToGoogleDrive } from "../connectors/google-workspace.js";
import { config } from "../config.js";

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post("/uploads", { preHandler: requireAuth }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "No file provided" });
    }

    const buffer = await data.toBuffer();
    const name = data.filename;
    const mimeType = data.mimetype;
    const userId = request.auth!.userId;

    // Check if store_in_drive is requested (passed as query param or part field)
    const storeInDrive = (request.query as any)?.store_in_drive === "true" || 
                         (data.fields?.store_in_drive as any)?.value === "true";

    // Write file to DB
    const { rows } = await pool.query(
      `
        INSERT INTO uploaded_files (user_id, name, mime_type, data, size)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, mime_type, size, created_at, expires_at
      `,
      [userId, name, mimeType, buffer, buffer.length]
    );
    const uploadedFile = rows[0]!;

    let driveFileResult = null;
    if (storeInDrive) {
      const driveToken = await googleAccessToken(userId, "drive");
      if (driveToken) {
        try {
          driveFileResult = await uploadFileToGoogleDrive(driveToken, name, mimeType, buffer);
        } catch (err) {
          request.log.error(err, "Google Drive copy upload failed");
        }
      }
    }

    return {
      file: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        mime_type: uploadedFile.mime_type,
        size: uploadedFile.size,
        created_at: uploadedFile.created_at,
        expires_at: uploadedFile.expires_at,
        url: `${config.AUTH_BASE_URL}/uploads/${uploadedFile.id}`
      },
      drive_copy: driveFileResult
    };
  });

  app.get("/uploads/:fileId", async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    if (!isUuid(fileId)) {
      return reply.code(400).send({ error: "Invalid file ID" });
    }

    const { rows } = await pool.query(
      "SELECT name, mime_type, data FROM uploaded_files WHERE id = $1 AND expires_at > NOW()",
      [fileId]
    );
    const file = rows[0];
    if (!file) {
      return reply.code(404).send({ error: "File not found or expired" });
    }

    return reply
      .header("Content-Type", file.mime_type)
      .header("Content-Disposition", `inline; filename="${file.name}"`)
      .send(file.data);
  });
}
