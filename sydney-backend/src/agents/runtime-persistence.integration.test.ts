import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { parseIntent } from "./parser.js";
import { compileAgentDefinition } from "./runtime/compiler.js";
import {
  insertConfiguredAgent,
  loadCurrentAgentDefinition,
  loadRuntimeState,
  reviseAgentDefinition
} from "./runtime/configuration-service.js";
import { applyAgentStateEvents } from "./runtime/state-store.js";

const connectionString = process.env.TEST_DATABASE_URL;

test(
  "PostgreSQL revisions are immutable, state survives recompilation, and runs stay pinned",
  { skip: !connectionString },
  async () => {
    const testPool = new pg.Pool({ connectionString });
    const userId = `runtime-test-${Date.now()}`;
    let agentId = "";
    try {
      await testPool.query(
        `INSERT INTO users (id, name, email, email_verified)
         VALUES ($1, 'Runtime Test', $2, TRUE)`,
        [userId, `${userId}@example.test`]
      );
      const client = await testPool.connect();
      try {
        await client.query("BEGIN");
        const prompt = "Send me tech news every day at 7am";
        const parsed = parseIntent(prompt);
        const agent = await insertConfiguredAgent<{ id: string }>(client, {
          userId,
          name: parsed.name,
          avatar: parsed.avatar,
          prompt,
          parsedIntent: parsed,
          createdBy: "integration_test"
        });
        agentId = agent.id;
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      const first = await loadCurrentAgentDefinition(agentId, testPool as any);
      assert.equal(first?.revision, 1);
      const persistedIntent = await testPool.query<{ parsed_intent: unknown }>(
        "SELECT parsed_intent FROM agents WHERE id = $1",
        [agentId]
      );
      assert.deepEqual(persistedIntent.rows[0]!.parsed_intent, {});

      const stateClient = await testPool.connect();
      try {
        await stateClient.query("BEGIN");
        await applyAgentStateEvents(stateClient, agentId, [
          { type: "topics.add", value: "Arrays" },
          { type: "history.set", key: "2026-07-17", value: true }
        ]);
        await stateClient.query("COMMIT");
      } catch (error) {
        await stateClient.query("ROLLBACK");
        throw error;
      } finally {
        stateClient.release();
      }

      const revisionClient = await testPool.connect();
      try {
        await revisionClient.query("BEGIN");
        const prompt = "Send me startup news every weekday at 8am";
        const parsed = parseIntent(prompt);
        await reviseAgentDefinition(revisionClient, {
          agentId,
          userId,
          definition: compileAgentDefinition(parsed, prompt),
          name: parsed.name,
          avatar: parsed.avatar,
          prompt,
          createdBy: "integration_test"
        });
        await revisionClient.query("COMMIT");
      } catch (error) {
        await revisionClient.query("ROLLBACK");
        throw error;
      } finally {
        revisionClient.release();
      }

      const second = await loadCurrentAgentDefinition(agentId, testPool as any);
      assert.equal(second?.revision, 2);
      assert.deepEqual(await loadRuntimeState(agentId, testPool as any), {
        history: { "2026-07-17": true },
        topics_covered: ["Arrays"],
        current_chunk: 0
      });

      await assert.rejects(
        testPool.query(
          `UPDATE agent_config_revisions
           SET created_by = 'tampered'
           WHERE id = $1`,
          [first!.revisionId]
        ),
        /immutable/
      );

      const run = await testPool.query<{ config_revision: string }>(
        `INSERT INTO agent_runs
           (agent_id, queue_job_id, config_revision, status)
         VALUES ($1, $2, $3, 'running')
         RETURNING config_revision`,
        [agentId, `integration:${agentId}`, first!.revisionId]
      );
      assert.equal(run.rows[0]!.config_revision, first!.revisionId);
      assert.notEqual(run.rows[0]!.config_revision, second!.revisionId);
    } finally {
      if (agentId) {
        await testPool.query("DELETE FROM agents WHERE id = $1", [agentId]);
      }
      await testPool.query("DELETE FROM users WHERE id = $1", [userId]);
      await testPool.end();
    }
  }
);
