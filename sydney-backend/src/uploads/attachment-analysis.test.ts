import assert from "node:assert/strict";
import test from "node:test";
import {
  AttachmentValidationError,
  attachmentContextExpiresAt,
  boundedStoredAttachmentContext,
  detectMime,
  maxExtractedTextBytes,
  maxStoredAttachmentContextBytes,
  validateUploadedAttachment
} from "./attachment-analysis.js";

test("expires extracted context one day after binary deletion", () => {
  const binaryExpiry = new Date("2026-07-17T12:00:00.000Z");
  assert.equal(
    attachmentContextExpiresAt(binaryExpiry, 1).toISOString(),
    "2026-07-18T12:00:00.000Z"
  );
});

test("stores only a bounded conversational excerpt below the parsing ceiling", () => {
  const excerpt = boundedStoredAttachmentContext("🙂".repeat(100_000));
  assert.ok(Buffer.byteLength(excerpt, "utf8") <= maxStoredAttachmentContextBytes);
  assert.ok(maxStoredAttachmentContextBytes < maxExtractedTextBytes);
  assert.equal(excerpt.includes("\uFFFD"), false);
});

test("detects supported image and PDF signatures", () => {
  assert.equal(
    detectMime("photo.bin", "application/octet-stream", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    "image/jpeg"
  );
  assert.equal(
    detectMime("doc.txt", "text/plain", Buffer.from("%PDF-1.7\n")),
    "application/pdf"
  );
});

test("rejects MIME-spoofed binary text and invalid JSON", () => {
  assert.equal(detectMime("bad.txt", "text/plain", Buffer.from([0, 1, 2])), null);
  assert.equal(detectMime("bad.json", "application/json", Buffer.from("{nope")), null);
});

test("accepts bounded text formats and rejects unsupported formats", () => {
  assert.equal(
    validateUploadedAttachment({
      name: "notes.md",
      declaredMime: "text/markdown",
      data: Buffer.from("# Notes")
    }).mimeType,
    "text/markdown"
  );
  assert.throws(
    () => validateUploadedAttachment({
      name: "archive.zip",
      declaredMime: "application/zip",
      data: Buffer.from([0x50, 0x4b, 0x03, 0x04])
    }),
    AttachmentValidationError
  );
});
