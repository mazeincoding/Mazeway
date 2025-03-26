import { NextRequest, NextResponse } from "next/server";
import { TApiErrorResponse } from "@/types/api";

// Generic type for table records
type TableRecord<T = any> = {
  [key: string]: T;
};

// Types for different webhook payloads
type InsertPayload = {
  type: "INSERT";
  table: string;
  schema: string;
  record: TableRecord;
  old_record: null;
};

type UpdatePayload = {
  type: "UPDATE";
  table: string;
  schema: string;
  record: TableRecord;
  old_record: TableRecord;
};

type DeletePayload = {
  type: "DELETE";
  table: string;
  schema: string;
  record: null;
  old_record: TableRecord;
};

// Combined type for all possible webhook payloads
type WebhookPayload = InsertPayload | UpdatePayload | DeletePayload;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);

  console.log(
    `[WEBHOOK:${requestId}] 🔔 Request received at ${new Date().toISOString()}`
  );

  try {
    // Parse and log the webhook payload
    const requestText = await request.text();
    let payload: WebhookPayload;

    try {
      payload = JSON.parse(requestText) as WebhookPayload;
      console.log(`[WEBHOOK:${requestId}] 📊 Payload received:`, {
        type: payload.type,
        table: payload.table,
        schema: payload.schema,
        record: payload.record,
        old_record: payload.old_record,
      });
    } catch (e) {
      console.error(`[WEBHOOK:${requestId}] ❌ Failed to parse JSON:`, e);
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    return NextResponse.json({
      success: true,
      message: "Webhook received and logged",
      processing_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error(
      `[WEBHOOK:${requestId}] 💥 Unhandled error processing webhook:`,
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
