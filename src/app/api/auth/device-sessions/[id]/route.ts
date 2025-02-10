import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TEmptySuccessResponse,
  TRevokeDeviceSessionResponse,
} from "@/types/api";
import { apiRateLimit, getClientIp } from "@/utils/rate-limit";
import { verifyTwoFactorCode } from "@/utils/auth";
import { twoFactorVerificationSchema } from "@/utils/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import { checkTwoFactorRequirements } from "@/utils/auth";

/**
 * Deletes a device session. Security is enforced through multiple layers:
 * 1. Validates the auth token via getUser() to ensure the request is authenticated
 * 2. Verifies the authenticated user owns the device session they're trying to delete
 * 3. Requires 2FA verification for additional security if enabled in config and not already provided
 *
 * The endpoint handles both initial deletion requests and 2FA verification:
 * - Initial request: Checks if 2FA is needed and returns requirements
 * - With 2FA: Verifies the code and completes the deletion
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Even though TypeScript thinks "await" doesn't have an effect
  // It does. It's required in Next.js dynamic API routes
  const sessionId = (await params).id;

  if (apiRateLimit) {
    const ip = getClientIp(request);
    const { success } = await apiRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }
  }

  const supabase = await createClient();

  try {
    // First security layer: Validate auth token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Second security layer: Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from("device_sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found or unauthorized");
    }

    // Check if this is a 2FA verification request
    let body;
    try {
      body = await request.json();
    } catch {
      // No body provided, treat as initial request
      body = null;
    }

    // If body exists, try to validate as 2FA verification
    if (body) {
      const validation = twoFactorVerificationSchema.safeParse(body);

      if (validation.success) {
        const { factorId, code } = validation.data;

        try {
          // Verify 2FA code
          await verifyTwoFactorCode(supabase, factorId, code);

          // Create service role client for deletion
          const adminClient = await createClient({ useServiceRole: true });

          // Delete the session after successful 2FA verification
          const { error: deleteError } = await adminClient
            .from("device_sessions")
            .delete()
            .eq("session_id", sessionId);

          if (deleteError) throw deleteError;

          return NextResponse.json(
            {}
          ) satisfies NextResponse<TEmptySuccessResponse>;
        } catch (error) {
          return NextResponse.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to verify code",
            },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }
      }
    }

    // If we reach here, this is an initial request - check if 2FA is required based on config
    if (
      AUTH_CONFIG.twoFactorAuth.enabled &&
      AUTH_CONFIG.twoFactorAuth.requireFor.deviceLogout
    ) {
      try {
        // Use the existing utility to check 2FA requirements
        const twoFactorResult = await checkTwoFactorRequirements(supabase);

        // Only require 2FA if user has it enabled
        if (
          twoFactorResult.requiresTwoFactor &&
          twoFactorResult.availableMethods?.length
        ) {
          return NextResponse.json({
            ...twoFactorResult,
            sessionId,
          }) satisfies NextResponse<TRevokeDeviceSessionResponse>;
        }
      } catch (error) {
        console.error("Error checking 2FA requirements:", error);
        throw new Error("Failed to check 2FA status");
      }
    }

    // If no 2FA required, disabled in config, or user doesn't have 2FA enabled, delete the session
    const adminClient = await createClient({ useServiceRole: true });
    const { error: deleteError } = await adminClient
      .from("device_sessions")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) throw deleteError;

    return NextResponse.json({}) satisfies NextResponse<TEmptySuccessResponse>;
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message },
      {
        status:
          error instanceof Error &&
          (error.message === "Unauthorized" ||
            error.message === "Session not found or unauthorized")
            ? 401
            : 500,
      }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
