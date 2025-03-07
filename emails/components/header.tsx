import { Img } from "@react-email/components";

export function Header() {
  return (
    <div>
      {/* App logo */}
      <Img
        src="https://res.cloudinary.com/dzjgehvid/image/upload/v1741312446/Frame_38_1_1_vb3lre.png"
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
