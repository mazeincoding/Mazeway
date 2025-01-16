import { Text, Img } from "@react-email/components";

export function Header() {
  return (
    <div>
      <Img
        src="https://rqsfebcljeizuojtkabi.supabase.co/storage/v1/object/public/logo/Frame%2038%20(1).png"
        width={32}
        height={32}
        alt="Logo"
        style={{ marginBottom: "12px" }}
      />
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "bold", 
          margin: "0 0 24px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        Auth
      </Text>
    </div>
  );
}
