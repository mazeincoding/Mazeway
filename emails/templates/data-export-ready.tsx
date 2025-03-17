// Email notification when a user's data export is ready for download

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
  Button,
} from "@react-email/components";
import { Header } from "../components/header";
import { AUTH_CONFIG } from "@/config/auth";

interface TDataExportReadyProps {
  email: string;
  downloadUrl: string;
  expiresInHours: number;
}

export default function DataExportReadyTemplate({
  email = "user@example.com",
  downloadUrl = "https://example.com/download",
  expiresInHours = AUTH_CONFIG.dataExport.downloadExpirationTime,
}: TDataExportReadyProps) {
  return (
    <Html>
      <Head />
      <Preview>Your data export is ready for download</Preview>
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
            Your data export is ready
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
              Your requested data export for ({email}) is now ready for
              download. For security reasons, the download link will expire in{" "}
              {expiresInHours} hours.
            </Text>
          </Section>

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
              Download Link:
            </Heading>
            <Text style={{ margin: "8px 0", color: "#5f6368" }}>
              <Button
                href={downloadUrl}
                style={{
                  backgroundColor: "#202124",
                  borderRadius: "4px",
                  color: "#ffffff",
                  fontSize: "16px",
                  textDecoration: "none",
                  display: "inline-block",
                  padding: "12px 24px",
                }}
              >
                Download my data
              </Button>
            </Text>
            <Text style={{ margin: "16px 0 0", color: "#5f6368" }}>
              <strong>Direct link:</strong>{" "}
              <Link
                href={downloadUrl}
                style={{
                  color: "#202124",
                  textDecoration: "underline",
                }}
              >
                {downloadUrl}
              </Link>
            </Text>
          </Section>

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
