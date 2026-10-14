import React from "react";

interface PearlAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  letter?: string;
  size?: number;
  className?: string;
}

export const PearlAvatar: React.FC<PearlAvatarProps> = ({
  letter = "A",
  size = 38,
  className = "",
  ...props
}) => {
  return (
    <>
      <style>{`
        .pearl-avatar {
          --white: #ffe7ff;
          --bg: #09090b;
          position: relative;
          border-radius: 50%;
          background-color: var(--bg);
          box-shadow:
            inset 0 0.2rem 0.5rem rgba(255, 255, 255, 0.4),
            inset 0 -0.1rem 0.25rem rgba(0, 0, 0, 0.8),
            inset 0 -0.25rem 0.6rem rgba(255, 255, 255, 0.35),
            0 8px 16px rgba(0, 0, 0, 0.5),
            0 2px 4px rgba(0, 0, 0, 0.7);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          flex-shrink: 0;
        }
        .pearl-avatar::before {
          content: "";
          position: absolute;
          left: -10%;
          right: -10%;
          bottom: 25%;
          top: -100%;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.16);
          pointer-events: none;
          transition: all 0.25s ease;
        }
        .pearl-avatar::after {
          content: "";
          position: absolute;
          left: 10%;
          right: 10%;
          top: 8%;
          bottom: 40%;
          border-radius: 50px 50px 0 0;
          box-shadow: inset 0 6px 6px -6px rgba(255, 255, 255, 0.9);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.35) 0%,
            rgba(0, 0, 0, 0) 55%,
            rgba(0, 0, 0, 0) 100%
          );
          pointer-events: none;
          transition: all 0.25s ease;
        }
        .pearl-avatar .pearl-avatar-letter {
          position: relative;
          z-index: 1;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: -0.02em;
          color: #ffffff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8), 0 0 10px rgba(255, 255, 255, 0.4);
          transform: translateY(1px);
          font-family: inherit;
        }
        .pearl-avatar:hover {
          box-shadow:
            inset 0 0.25rem 0.6rem rgba(255, 255, 255, 0.55),
            inset 0 -0.1rem 0.25rem rgba(0, 0, 0, 0.8),
            inset 0 -0.3rem 0.7rem rgba(255, 255, 255, 0.45),
            0 10px 20px rgba(0, 0, 0, 0.6),
            0 3px 6px rgba(0, 0, 0, 0.8);
          transform: translateY(-1px);
        }
        .pearl-avatar:hover::before {
          transform: translateY(-4%);
        }
        .pearl-avatar:hover::after {
          opacity: 0.7;
        }
        .pearl-avatar:active {
          transform: translateY(1px);
          box-shadow:
            inset 0 0.2rem 0.4rem rgba(255, 255, 255, 0.5),
            inset 0 -0.1rem 0.3rem rgba(0, 0, 0, 0.9),
            inset 0 -0.25rem 0.5rem rgba(255, 255, 255, 0.3),
            0 4px 8px rgba(0, 0, 0, 0.5);
        }
      `}</style>
      <div
        className={`pearl-avatar ${className}`}
        style={{ width: size, height: size }}
        {...props}
      >
        <span className="pearl-avatar-letter">{letter}</span>
      </div>
    </>
  );
};
