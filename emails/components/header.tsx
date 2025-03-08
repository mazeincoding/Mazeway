import { Img } from "@react-email/components";

export function Header() {
  return (
    <div>
      {/* App logo */}
      <Img
        src="https://res.cloudinary.com/dzjgehvid/image/upload/v1741404455/text-logo-black-demo_lc3pn4.png"
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
