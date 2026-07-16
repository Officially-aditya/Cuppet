import type { FastifyInstance, FastifyReply } from "fastify";
import { isUuid } from "../api/ids.js";
import { pool } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { googleAccessToken, uploadFileToGoogleDrive } from "../connectors/google-workspace.js";
import { config } from "../config.js";
import {
  AttachmentValidationError,
  validateUploadedAttachment
} from "./attachment-analysis.js";
import { storeTemporaryUpload, UploadQuotaError } from "./quota.js";

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post("/uploads", { preHandler: requireAuth }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "No file provided" });
    }

    const buffer = await data.toBuffer();
    const name = data.filename;
    let mimeType: string;
    const userId = request.auth!.userId;

    try {
      mimeType = validateUploadedAttachment({
        name,
        declaredMime: data.mimetype,
        data: buffer
      }).mimeType;
    } catch (error) {
      if (error instanceof AttachmentValidationError) {
        return reply.code(415).send({
          error: { code: error.code, message: error.message }
        });
      }
      throw error;
    }

    // Check if store_in_drive is requested (passed as query param or part field)
    const storeInDrive = (request.query as any)?.store_in_drive === "true" || 
                         (data.fields?.store_in_drive as any)?.value === "true";

    let uploadedFile;
    try {
      uploadedFile = await storeTemporaryUpload({
        userId,
        name,
        mimeType,
        data: buffer
      });
    } catch (error) {
      if (error instanceof UploadQuotaError) {
        return reply.code(429).send({
          error: {
            code: error.code,
            message: error.message,
            limits: {
              active_files: error.limits.maxFiles,
              active_bytes: error.limits.maxBytes
            }
          }
        });
      }
      throw error;
    }

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

  app.get("/uploads/:fileId", { preHandler: requireAuth }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    if (!isUuid(fileId)) {
      return reply.code(400).send({ error: "Invalid file ID" });
    }

    const { rows } = await pool.query(
      "SELECT name, mime_type, data FROM uploaded_files WHERE id = $1 AND user_id = $2 AND expires_at > NOW()",
      [fileId, request.auth!.userId]
    );
    const file = rows[0];
    if (!file) {
      return reply.code(404).send({ error: "File not found or expired" });
    }
    const safeName = String(file.name).replace(/[\r\n"]/g, "_");

    return reply
      .header("Content-Type", file.mime_type)
      .header("Content-Disposition", `inline; filename="${safeName}"`)
      .send(file.data);
  });
}
