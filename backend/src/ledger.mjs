import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { LEDGER_TABLE } from "./config.mjs";

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

/**
 * Inserts a ledger entry idempotently. `entryId` is the idempotency key —
 * for Stellar deposits it's `stellar:<txHash>`, so a conditional put
 * (attribute_not_exists) makes "never credit the same transaction twice" a
 * guarantee enforced by DynamoDB itself, not application logic that could
 * race under concurrent invocations (e.g. the scheduled poller and a
 * manual "check now" from the frontend running at the same moment).
 *
 * @returns {Promise<boolean>} true if inserted, false if it already existed.
 */
export async function putEntryIfAbsent(entry) {
  try {
    await doc.send(
      new PutCommand({
        TableName: LEDGER_TABLE,
        Item: entry,
        ConditionExpression: "attribute_not_exists(entryId)",
      })
    );
    return true;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}

/** Full ledger scan — fine at hackathon-demo volume; not meant to scale past that. */
export async function listEntries() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(new ScanCommand({ TableName: LEDGER_TABLE, ExclusiveStartKey }));
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}
