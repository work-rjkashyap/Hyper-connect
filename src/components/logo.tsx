import type { SVGProps } from "react";

export function HyperconnectLogo(
    props: SVGProps<SVGSVGElement>,
): React.ReactElement {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            fill="none"
            width="28"
            height="28"
            role="img"
            aria-label="Hyperconnect Logo"
            {...props}
        >
            <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
            </defs>
            {/* Outer rounded square */}
            <rect
                x="1"
                y="1"
                width="30"
                height="30"
                rx="8"
                stroke="url(#logo-grad)"
                strokeWidth="2"
                fill="none"
            />
            {/* Stylised "H" with connection nodes */}
            <path
                d="M10 8v16M22 8v16M10 16h12"
                stroke="url(#logo-grad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Connection dots */}
            <circle cx="10" cy="8" r="2" fill="#22d3ee" />
            <circle cx="22" cy="8" r="2" fill="#8b5cf6" />
            <circle cx="10" cy="24" r="2" fill="#22d3ee" />
            <circle cx="22" cy="24" r="2" fill="#8b5cf6" />
            <circle cx="16" cy="16" r="2" fill="url(#logo-grad)" />
        </svg>
    );
}
