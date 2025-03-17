// Email notification when a user requests a data export

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
import { TDeviceInfo } from "@/types/auth";

interface TDataExportRequestedProps {
  email: string;
  device?: TDeviceInfo;
}

export default function DataExportRequestedTemplate({
  email = "user@example.com",
  device,
}: TDataExportRequestedProps) {
  return (
    <Html>
      <Head />
      <Preview>Your data export request has been received</Preview>
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
            Data export request received
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
              We've received a request to export your account data ({email}).
              We'll process this request and send you another email when your
              data is ready to download.
            </Text>
          </Section>

          {/* Show device details if provided */}
          {device && (
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
                Device Details:
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
