// Generic email alert template for security-related notifications.

import { TSendEmailAlertRequest } from "@/types/api";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Link,
} from "@react-email/components";
import { Header } from "../components/header";

type EmailAlertTemplateProps = TSendEmailAlertRequest;

export default function EmailAlertTemplate({
  email = "test@test.com",
  title = "Security Alert",
  message = "A security-related change was made to your account.",
  device,
  oldEmail,
  newEmail,
  method,
  revokedDevice,
}: EmailAlertTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ padding: "40px 20px" }}>
          <Header />

          <Heading
            as="h1"
            style={{
              fontSize: "24px",
              fontWeight: "600",
              color: "#202124",
              textAlign: "left",
              margin: "30px 0 20px",
            }}
          >
            {title}
          </Heading>

          <Section style={{ marginBottom: "16px" }}>
            <Text
              style={{
                fontSize: "16px",
                lineHeight: "1.5",
                color: "#5f6368",
                margin: "0 0 16px",
              }}
            >
              {message} ({email})
            </Text>
          </Section>

          {/* Show email change details if provided */}
          {oldEmail && newEmail && (
            <Section
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                marginBottom: "16px",
              }}
            >
              <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                <strong>Changed From:</strong> {oldEmail}
              </Text>
              <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                <strong>Changed To:</strong> {newEmail}
              </Text>
            </Section>
          )}

          {/* Show 2FA method if provided */}
          {method && (
            <Section
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                marginBottom: "16px",
              }}
            >
              <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                <strong>Authentication Method:</strong> {method}
              </Text>
            </Section>
          )}

          {/* Show revoked device details if provided */}
          {revokedDevice && (
            <Section
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
                marginBottom: "16px",
              }}
            >
              <Heading
                as="h2"
                style={{
                  fontSize: "18px",
                  color: "#202124",
                  margin: "0 0 16px",
                }}
              >
                Revoked Device Details:
              </Heading>
              <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                <strong>Device:</strong> {revokedDevice.device_name}
              </Text>
              {revokedDevice.browser && (
                <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                  <strong>Browser:</strong> {revokedDevice.browser}
                </Text>
              )}
              {revokedDevice.os && (
                <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                  <strong>Operating System:</strong> {revokedDevice.os}
                </Text>
              )}
              {revokedDevice.ip_address && (
                <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                  <strong>IP Address:</strong> {revokedDevice.ip_address}
                </Text>
              )}
            </Section>
          )}

          {/* Show current device details if provided */}
          {device && (
            <Section
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
              }}
            >
              <Heading
                as="h2"
                style={{
                  fontSize: "18px",
                  color: "#202124",
                  margin: "0 0 16px",
                }}
              >
                {revokedDevice ? "Action Performed From:" : "Device Details:"}
              </Heading>
              <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                <strong>Device:</strong> {device.device_name}
              </Text>
              {device.browser && (
                <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                  <strong>Browser:</strong> {device.browser}
                </Text>
              )}
              {device.os && (
                <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                  <strong>Operating System:</strong> {device.os}
                </Text>
              )}
              {device.ip_address && (
                <Text style={{ margin: "8px 0", color: "#5f6368" }}>
                  <strong>IP Address:</strong> {device.ip_address}
                </Text>
              )}
            </Section>
          )}

          <Text
            style={{
              fontSize: "14px",
              color: "#5f6368",
              marginTop: "20px",
              textAlign: "left",
            }}
          >
            If this wasn't you, please secure your account immediately by{" "}
            <Link
              href="/account/security"
              style={{ color: "#202124", textDecoration: "underline" }}
            >
              changing your password
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
