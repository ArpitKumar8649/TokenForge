import React from "react";

type PearlButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  size?: "default" | "compact" | "hero";
  icon?: React.ReactNode;
};

export const PearlButton: React.FC<PearlButtonProps> = ({
  label = "Pearl Button",
  size = "default",
  icon,
  className = "",
  children,
  ...props
}) => {
  return (
    <>
      <style>{`
        .pearl-button {
          --white: #ffe7ff;
          --bg: #080808;
          --radius: 100px;
          outline: none;
          cursor: pointer;
          border: 0;
          position: relative;
          border-radius: var(--radius);
          background-color: var(--bg);
          transition: all 0.2s ease;
          box-shadow:
            inset 0 0.3rem 0.9rem rgba(255, 255, 255, 0.3),
            inset 0 -0.1rem 0.3rem rgba(0, 0, 0, 0.7),
            inset 0 -0.4rem 0.9rem rgba(255, 255, 255, 0.5),
            0 1.5rem 2rem rgba(0, 0, 0, 0.4),
            0 0.5rem 1rem -0.3rem rgba(0, 0, 0, 0.8);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          user-select: none;
          box-sizing: border-box;
          max-width: 100%;
        }
        .pearl-button.compact,
        .pearl-button.hero,
        .pearl-button.w-full {
          width: 100%;
        }
        @media (max-width: 640px) {
          .pearl-button.w-full,
          .pearl-button.sm\\:w-auto {
            width: 100%;
          }
          .pearl-button .wrap {
            padding: 11px 16px !important;
            min-height: 44px !important;
            font-size: 13px !important;
          }
        }
        .pearl-button .wrap {
          font-size: 13.5px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: rgba(255, 255, 255, 0.9);
          padding: 14px 24px;
          min-height: 48px;
          border-radius: inherit;
          position: relative;
          overflow: hidden;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pearl-button.hero .wrap {
          font-size: 14.5px;
          font-weight: 700;
          padding: 15px 28px;
          min-height: 52px;
        }
        .pearl-button.default .wrap {
          font-size: 15px;
          padding: 16px 32px;
          min-height: 52px;
        }
        .pearl-button .wrap p span.sparkle:nth-child(2) {
          display: none;
        }
        .pearl-button:hover .wrap p span.sparkle:nth-child(1) {
          display: none;
        }
        .pearl-button:hover .wrap p span.sparkle:nth-child(2) {
          display: inline-block;
        }
        .pearl-button .wrap p {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 0;
          transition: all 0.2s ease;
          transform: translateY(2%);
          -webkit-mask-image: linear-gradient(to bottom, white 55%, transparent);
                  mask-image: linear-gradient(to bottom, white 55%, transparent);
        }
        .pearl-button .wrap::before,
        .pearl-button .wrap::after {
          content: "";
          position: absolute;
          transition: all 0.3s ease;
        }
        .pearl-button .wrap::before {
          left: -15%;
          right: -15%;
          bottom: 25%;
          top: -100%;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.12);
        }
        .pearl-button .wrap::after {
          left: 6%;
          right: 6%;
          top: 12%;
          bottom: 40%;
          border-radius: 22px 22px 0 0;
          box-shadow: inset 0 10px 8px -10px rgba(255, 255, 255, 0.8);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.3) 0%,
            rgba(0, 0, 0, 0) 50%,
            rgba(0, 0, 0, 0) 100%
          );
        }
        .pearl-button:hover {
          box-shadow:
            inset 0 0.3rem 0.5rem rgba(255, 255, 255, 0.4),
            inset 0 -0.1rem 0.3rem rgba(0, 0, 0, 0.7),
            inset 0 -0.4rem 0.9rem rgba(255, 255, 255, 0.7),
            0 2rem 2.5rem rgba(0, 0, 0, 0.4),
            0 0.8rem 1rem -0.4rem rgba(0, 0, 0, 0.8);
        }
        .pearl-button:hover .wrap::before {
          transform: translateY(-5%);
        }
        .pearl-button:hover .wrap::after {
          opacity: 0.4;
          transform: translateY(5%);
        }
        .pearl-button:hover .wrap p {
          transform: translateY(-4%);
          color: #ffffff;
        }
        .pearl-button:active {
          transform: translateY(2px);
          box-shadow:
            inset 0 0.3rem 0.5rem rgba(255, 255, 255, 0.5),
            inset 0 -0.1rem 0.3rem rgba(0, 0, 0, 0.8),
            inset 0 -0.4rem 0.9rem rgba(255, 255, 255, 0.4),
            0 1rem 1rem rgba(0, 0, 0, 0.3),
            0 0.5rem 0.7rem -0.3rem rgba(0, 0, 0, 0.8);
        }
        .pearl-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>

      <button className={`pearl-button ${size} ${className}`} {...props}>
        <div className="wrap">
          <p>
            {icon ? (
              <span className="flex items-center">{icon}</span>
            ) : (
              <>
                <span className="sparkle text-[#ffcf8d]">✧</span>
                <span className="sparkle text-[#ffcf8d]">✦</span>
              </>
            )}
            {children || label}
          </p>
        </div>
      </button>
    </>
  );
};
