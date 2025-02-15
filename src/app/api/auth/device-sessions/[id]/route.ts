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

    // Get current device session ID from cookie
    const currentSessionId = request.cookies.get("device_session_id")?.value;
    if (!currentSessionId) throw new Error("No device session found");

    // Verify current device session is valid and not expired
    const { data: currentSession, error: currentSessionError } = await supabase
      .from("device_sessions")
      .select("id")
      .eq("id", currentSessionId)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (currentSessionError || !currentSession) {
      throw new Error("Current device session is invalid or expired");
    }

    // Second security layer: Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from("device_sessions")
      .select("id")
      .eq("id", sessionId)
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

          // Get current device session ID from cookie
          const currentSessionId =
            request.cookies.get("device_session_id")?.value;

          // Update last_verified timestamp only for the current device session
          if (currentSessionId) {
            await adminClient
              .from("device_sessions")
              .update({ last_verified: new Date().toISOString() })
              .eq("id", currentSessionId);
          }

          // Delete the session after successful 2FA verification
          const { error: deleteError } = await adminClient
            .from("device_sessions")
            .delete()
            .eq("id", sessionId);

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

    // If we reach here, this is an initial request - check if 2FA is required
    if (AUTH_CONFIG.twoFactorAuth.enabled) {
      try {
        // Use the existing utility to check 2FA requirements
        const twoFactorResult = await checkTwoFactorRequirements(supabase);

        // If user has 2FA enabled, we need to check their AAL level
        if (twoFactorResult.requiresTwoFactor) {
          // Check current AAL level
          const { data: aalData, error: aalError } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

          // If they don't have AAL2, require 2FA verification
          if (aalError || aalData.currentLevel !== "aal2") {
            return NextResponse.json({
              ...twoFactorResult,
              sessionId,
            }) satisfies NextResponse<TRevokeDeviceSessionResponse>;
          }

          // If they have AAL2 but config requires fresh verification
          if (
            AUTH_CONFIG.twoFactorAuth.requireFreshVerificationFor.deviceLogout
              .enabled
          ) {
            // Get the current device session ID from cookie
            const currentSessionId =
              request.cookies.get("device_session_id")?.value;

            // Check if there's a recent 2FA verification within grace period for this device only
            const { data: recentVerification } = await supabase
              .from("device_sessions")
              .select("last_verified")
              .eq("user_id", user.id)
              .eq("id", currentSessionId)
              .single();

            const gracePeriodMinutes =
              AUTH_CONFIG.twoFactorAuth.requireFreshVerificationFor.deviceLogout
                .gracePeriodMinutes;
            const now = new Date();
            const gracePeriodStart = new Date(
              now.getTime() - gracePeriodMinutes * 60 * 1000
            );

            // If there's a recent verification within grace period on this device, allow the operation
            if (
              recentVerification?.last_verified &&
              new Date(recentVerification.last_verified) > gracePeriodStart
            ) {
              // Skip 2FA verification - within grace period on current device
            } else {
              // Require fresh 2FA verification
              return NextResponse.json({
                ...twoFactorResult,
                sessionId,
              }) satisfies NextResponse<TRevokeDeviceSessionResponse>;
            }
          }
        }
      } catch (error) {
        console.error("Error checking 2FA requirements:", error);
        throw new Error("Failed to check 2FA status");
      }
    }

    // If we reach here, either:
    // 1. User doesn't have 2FA enabled
    // 2. User has AAL2 and fresh verification is not required
    // 3. 2FA is disabled in config
    const adminClient = await createClient({ useServiceRole: true });
    const { error: deleteError } = await adminClient
      .from("device_sessions")
      .delete()
      .eq("id", sessionId);

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
