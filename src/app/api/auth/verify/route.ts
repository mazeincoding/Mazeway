import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  TApiErrorResponse,
  TVerifyRequest,
  TVerifyResponse,
} from "@/types/api";
import { TTwoFactorMethod, TAAL } from "@/types/auth";
import { authRateLimit, smsRateLimit, getClientIp } from "@/utils/rate-limit";
import { verificationSchema } from "@/utils/validation/auth-validation";
import { AUTH_CONFIG } from "@/config/auth";
import {
  verifyVerificationCode,
  generateVerificationCodes,
} from "@/utils/verification-codes";
import { getDeviceSessionId, getUser } from "@/utils/auth";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = await createClient({ useServiceRole: true });

    // 1. Verify user authentication first
    const { user, error } = await getUser(supabase);
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // 2. Get and validate request body
    const rawBody = await request.json();
    const validation = verificationSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    const body: TVerifyRequest = validation.data;
    const { factorId, code, method } = body;

    // Get device session ID early since we'll need it for all methods
    const deviceSessionId = getDeviceSessionId(request);
    if (!deviceSessionId) {
      return NextResponse.json(
        { error: "No device session found" },
        { status: 400 }
      ) satisfies NextResponse<TApiErrorResponse>;
    }

    // Track if verification was successful and if backup codes were generated
    let verificationSuccessful = false;
    let backupCodes: string[] | undefined;

    // 3. Handle verification based on method
    switch (method) {
      case "backup_codes": {
        // Validate method configuration
        if (!AUTH_CONFIG.verificationMethods.twoFactor.backupCodes.enabled) {
          return NextResponse.json(
            { error: "Backup codes are not enabled" },
            { status: 403 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Find an unused backup code for this user
        const { data: backupCodesData, error: fetchError } = await adminClient
          .from("backup_codes")
          .select("id, code_hash, salt")
          .eq("user_id", user.id)
          .is("used_at", null)
          .order("created_at", { ascending: true });

        if (fetchError) {
          console.error("Error fetching backup codes:", fetchError);
          return NextResponse.json(
            { error: "Failed to verify backup code" },
            { status: 500 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Try to find a matching code
        let matchFound = false;
        for (const backupCode of backupCodesData || []) {
          const isValid = await verifyVerificationCode(
            code,
            backupCode.code_hash,
            backupCode.salt
          );

          if (isValid) {
            // Mark the code as used
            const { error: updateError } = await adminClient
              .from("backup_codes")
              .update({ used_at: new Date().toISOString() })
              .eq("id", backupCode.id);

            if (updateError) {
              console.error("Error marking backup code as used:", updateError);
              return NextResponse.json(
                { error: "Failed to process backup code" },
                { status: 500 }
              ) satisfies NextResponse<TApiErrorResponse>;
            }

            matchFound = true;
            break;
          }
        }

        if (!matchFound) {
          return NextResponse.json(
            { error: "Invalid backup code" },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        verificationSuccessful = true;
        break;
      }

      case "authenticator":
      case "sms": {
        // Validate method configuration
        const methodConfig =
          method === "sms"
            ? AUTH_CONFIG.verificationMethods.twoFactor.sms
            : AUTH_CONFIG.verificationMethods.twoFactor.authenticator;

        if (!methodConfig?.enabled) {
          return NextResponse.json(
            { error: `${method} method is not enabled` },
            { status: 403 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Apply SMS-specific rate limits
        if (method === "sms") {
          const clientIp = getClientIp(request);
          if (smsRateLimit) {
            const { success: userSuccess } = await smsRateLimit.user.limit(
              user.id
            );
            if (!userSuccess) {
              return NextResponse.json(
                {
                  error: "Daily SMS limit reached. Please try again tomorrow.",
                },
                { status: 429 }
              ) satisfies NextResponse<TApiErrorResponse>;
            }

            const { success: ipSuccess } =
              await smsRateLimit.ip.limit(clientIp);
            if (!ipSuccess) {
              return NextResponse.json(
                { error: "Too many SMS requests. Please try again later." },
                { status: 429 }
              ) satisfies NextResponse<TApiErrorResponse>;
            }
          }
        }

        // Create challenge
        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId });
        if (challengeError) {
          return NextResponse.json(
            { error: challengeError.message },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Get the factor's status BEFORE we verify it
        const { data: preVerificationFactors } =
          await supabase.auth.mfa.listFactors();
        const factorBeforeVerification = preVerificationFactors?.all?.find(
          (f) => f.id === factorId
        );

        // If this factor was already verified before, this is not initial setup
        const isInitialTwoFactorSetup =
          factorBeforeVerification?.status !== "verified";

        // Verify the code
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code,
        });

        if (verifyError) {
          return NextResponse.json(
            { error: verifyError.message },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        verificationSuccessful = true;

        // Generate backup codes only during initial 2FA setup
        if (isInitialTwoFactorSetup) {
          const { codes, hashedCodes } = await generateVerificationCodes({
            format: AUTH_CONFIG.backupCodes.format,
            count: AUTH_CONFIG.backupCodes.count,
            wordCount: AUTH_CONFIG.backupCodes.wordCount,
            alphanumericLength: AUTH_CONFIG.backupCodes.alphanumericLength,
          });

          // Store hashed backup codes using admin client
          for (const { hash, salt } of hashedCodes) {
            const { error } = await adminClient.from("backup_codes").insert({
              user_id: user.id,
              code_hash: hash,
              salt,
            });

            if (error) {
              console.error("Error inserting backup code:", error);
              throw error;
            }
          }

          backupCodes = codes;
        }
        break;
      }

      case "password": {
        // Validate method configuration
        if (!AUTH_CONFIG.verificationMethods.password.enabled) {
          return NextResponse.json(
            { error: "Password verification is not enabled" },
            { status: 403 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Verify password using Supabase
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: code,
        });

        if (error) {
          return NextResponse.json(
            { error: "Invalid password" },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        verificationSuccessful = true;
        break;
      }

      case "email": {
        // Validate method configuration
        if (!AUTH_CONFIG.verificationMethods.email.enabled) {
          return NextResponse.json(
            { error: "Email verification is not enabled" },
            { status: 403 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Find the verification code in the database
        const { data: verificationCode, error: fetchError } = await adminClient
          .from("verification_codes")
          .select("*")
          .eq("device_session_id", deviceSessionId)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (fetchError || !verificationCode) {
          console.error("[Debug] Error or no verification code found:", {
            error: fetchError,
            foundCode: !!verificationCode,
          });
          return NextResponse.json(
            { error: "Failed to verify code" },
            { status: 500 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        // Verify the code hash
        const isValid = await verifyVerificationCode(
          code,
          verificationCode.code_hash,
          verificationCode.salt
        );

        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid or expired verification code" },
            { status: 400 }
          ) satisfies NextResponse<TApiErrorResponse>;
        }

        verificationSuccessful = true;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unsupported verification method" },
          { status: 400 }
        ) satisfies NextResponse<TApiErrorResponse>;
    }

    // If verification was successful, update the device session
    if (verificationSuccessful) {
      // First verify the session exists
      const { data: currentSession } = await adminClient
        .from("device_sessions")
        .select("aal")
        .eq("id", deviceSessionId)
        .eq("user_id", user.id)
        .single();

      // Prepare update data - always update last_sensitive_verification_at
      const updateData: {
        last_sensitive_verification_at: string;
        aal?: TAAL;
      } = {
        last_sensitive_verification_at: new Date().toISOString(),
      };

      // Only set AAL2 for 2FA methods
      const TWO_FACTOR_METHODS: TTwoFactorMethod[] = [
        "authenticator",
        "sms",
        "backup_codes",
      ];
      if (TWO_FACTOR_METHODS.includes(method as TTwoFactorMethod)) {
        updateData.aal = "aal2";
      }

      // Update device session
      const { error: updateError } = await adminClient
        .from("device_sessions")
        .update(updateData)
        .eq("id", deviceSessionId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("[Debug] Error updating device session:", updateError);
        return NextResponse.json(
          { error: "Failed to update session" },
          { status: 500 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    // Apply general rate limit
    if (authRateLimit) {
      const { success } = await authRateLimit.limit(getClientIp(request));
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        ) satisfies NextResponse<TApiErrorResponse>;
      }
    }

    return NextResponse.json({
      success: verificationSuccessful,
      backup_codes: backupCodes,
    }) satisfies NextResponse<TVerifyResponse>;
  } catch (error) {
    console.error("Error in verification:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    ) satisfies NextResponse<TApiErrorResponse>;
  }
}
