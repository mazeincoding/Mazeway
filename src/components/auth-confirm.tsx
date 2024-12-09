import { X } from "lucide-react";
import { Button } from "./ui/button";

interface ConfirmProps {
  email: string;
  show: boolean;
  onClose: () => void;
}

export function Confirm({ email, show, onClose }: ConfirmProps) {
  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center transition-all duration-200 ease-in-out backdrop-blur-xl ${
        show ? "opacity-100 visible" : "opacity-0 invisible"
      }`}
    >
      <div
        className={`space-y-4 flex flex-col items-center justify-center max-w-lg mx-auto text-center relative transition-all duration-200 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="text-3xl font-bold">Confirm your email</h1>
        <p className="text-muted-foreground text-lg">
          {email ? (
            <>
              Just sent a confirmation email to{" "}
              <strong className="text-foreground">{email}</strong>. Click the
              link inside to finish setting up your account.
            </>
          ) : (
            "It seems like no email was provided. Try refreshing the page and signing up again."
          )}
        </p>
        {email ? (
          <Button
            className="bg-transparent hover:bg-transparent h-auto w-auto text-muted-foreground hover:text-foreground p-0"
            disabled={true} // TODO: Disable only when there's a timeout.
            onClick={onClose}
          >
            Resend in 10 seconds{" "}
            {/* TODO: Make the time dynamic. Either a time or "Resend" */}
          </Button>
        ) : (
          <Button
            className="bg-transparent hover:bg-transparent h-auto w-auto text-muted-foreground hover:text-foreground p-0"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </Button>
        )}
      </div>
      {/* Using the basic HTML button instead of Shadcn because:
        1. The code is more maintainable in this case
        2. The Shadcn button adds a lot of complexity */}
      <button
        onClick={onClose}
        className="bg-transparent absolute top-6 right-6 group h-auto w-auto"
      >
        <X className="text-muted-foreground group-hover:text-foreground size-6" />
      </button>
    </div>
  );
}
