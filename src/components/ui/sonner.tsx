import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          /*
           * UX Exception: Toast notifications are a system-level UI component rendered
           * on a white (light) background. Dark text colors are required for readability
           * and accessibility contrast on white backgrounds.
           * Documented exception per UX_LOGIC.md Layer 3 — "All text is white" rule.
           */
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-gray-600",
          actionButton: "group-[.toast]:bg-black group-[.toast]:text-white font-semibold",
          cancelButton: "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-700",
        },
      }}
      {...props}
    />
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { Toaster, toast };
