export default function DeviceVerificationEmail({
  code,
  device_name,
  expires_in,
}: {
  code: string;
  device_name: string;
  expires_in: string;
}) {
  return <div>Device Verification Email</div>;
}
