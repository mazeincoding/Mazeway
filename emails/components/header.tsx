import { Img } from "@react-email/components";

export function Header() {
  return (
    <div>
      {/* App logo */}
      <Img
        src="https://rqsfebcljeizuojtkabi.supabase.co/storage/v1/object/public/logo/Frame%2038.png"
        alt="Logo"
        style={{
          marginBottom: "12px",
          maxWidth: "150px",
          width: "100%",
          height: "auto",
          display: "block",
        }}
      />
    </div>
  );
}
