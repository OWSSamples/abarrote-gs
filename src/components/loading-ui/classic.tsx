import { cn } from "@/lib/utils";

type ClassicProps = Omit<React.ComponentProps<"span">, "children"> & {
  size?: number;
  color?: string;
  duration?: number;
};

function Classic({
  className,
  size = 20,
  color = "currentColor",
  duration = 1.2,
  ...props
}: ClassicProps) {
  return (
    <>
      <style>{`
        @keyframes loading-ui-classic-fade {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.15;
          }
        }

        .loading-ui-classic-dot {
          position: absolute;
          top: -3.9%;
          left: -10%;
          display: block;
          height: 8%;
          width: 24%;
          border-radius: var(--radius, 0.25rem);
          background: var(--loading-color, currentColor);
          animation: loading-ui-classic-fade var(--duration, 1.2s) linear infinite;
          animation-delay: calc(var(--duration, 1.2s) / 12 * var(--index, 0));
          transform: rotate(calc(var(--index, 0) * 30deg)) translate(146%);
        }

        .loading-ui-classic-ring {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          animation: loading-ui-classic-rotate var(--duration, 1.2s) linear infinite;
        }

        @keyframes loading-ui-classic-rotate {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <span
        role="status"
        className={cn("loading-ui-classic-inline", className)}
        style={{
          "--loading-color": color,
          "--duration": `${duration}s`,
          width: `${size}px`,
          height: `${size}px`,
        } as React.CSSProperties}
        {...props}
      >
        <span
          aria-hidden="true"
          className="loading-ui-classic-ring"
        >
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              className="loading-ui-classic-dot"
              style={{ "--index": index } as React.CSSProperties}
            />
          ))}
        </span>
        <span className="sr-only">Cargando</span>
      </span>
    </>
  );
}

export { Classic };