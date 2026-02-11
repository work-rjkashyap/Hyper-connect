export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    date: string;
    author: string;
    tags: string[];
    readTime: string;
    coverImage: string;
    content: string[];
}

export const blogPosts: BlogPost[] = [
    {
        slug: "introducing-hyper-connect",
        coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=450&fit=crop",
        title: "Introducing Hyper Connect — The Local-First Sharing Layer",
        description:
            "We're launching Hyper Connect, a cross-platform tool for private, zero-config file sharing on your local network. No cloud, no accounts — just fast peer-to-peer transfers.",
        date: "2026-02-10",
        author: "Rajeshwar Kashyap",
        tags: ["Announcement", "Launch"],
        readTime: "4 min read",
        content: [
            "We're excited to announce the public launch of Hyper Connect — a cross-platform, open source tool for sharing files and data directly between devices on your local network.",
            "In a world where every file transfer seems to require a cloud account, Hyper Connect takes a different approach. Everything stays on your LAN. No sign-ups, no servers, no data leaving your network.",
            "## Why We Built This",
            "We kept running into the same problem: moving a file from one machine to another on the same desk shouldn't require uploading it to the cloud. USB drives feel archaic. AirDrop only works in the Apple ecosystem. Existing LAN tools are either outdated or hard to set up.",
            "Hyper Connect solves this with zero-configuration mDNS discovery and encrypted peer-to-peer TCP transfers. Open the app on two machines, and they find each other automatically.",
            "## What's Included in v1.0",
            "The initial release supports macOS, Windows, and Linux with a clean Electron-based desktop app. Key features include automatic device discovery via mDNS/Bonjour, end-to-end encrypted file transfers at LAN speed, a simple drag-and-drop interface, and system tray integration for quick access.",
            "## What's Next",
            "We're working on clipboard sharing across devices, a text/snippet sharing mode, and mobile companion apps for iOS and Android. Check our changelog for the latest updates.",
            "Hyper Connect is fully open source under the MIT License. We'd love your contributions — whether it's code, docs, design, or just filing issues. Head over to our GitHub repository to get started.",
        ],
    },
    {
        slug: "end-to-end-encryption-explained",
        coverImage: "https://images.unsplash.com/photo-1633265486064-086b219458ec?w=800&h=450&fit=crop",
        title: "How End-to-End Encryption Works in Hyper Connect",
        description:
            "A deep dive into how Hyper Connect encrypts every file transfer on your local network — from key exchange to AES-256 data encryption.",
        date: "2026-02-08",
        author: "Rajeshwar Kashyap",
        tags: ["Engineering", "Security"],
        readTime: "6 min read",
        content: [
            "Security was never an afterthought for Hyper Connect. Even though your files never leave your local network, we still encrypt every transfer end-to-end. Here's how it works.",
            "## The Threat Model",
            "On a shared network — whether it's your home Wi-Fi, an office LAN, or a coffee shop — other devices on the same network can potentially sniff unencrypted traffic. This means plaintext file transfers are vulnerable to eavesdropping even on \"trusted\" networks.",
            "Hyper Connect assumes the network is untrusted. Every byte of data transmitted between devices is encrypted.",
            "## Key Exchange",
            "When two devices discover each other via mDNS, they perform an Elliptic Curve Diffie-Hellman (ECDH) key exchange using Curve25519. This generates a shared secret without ever transmitting the key itself over the network.",
            "The shared secret is then derived into an AES-256-GCM session key using HKDF (HMAC-based Key Derivation Function). Each transfer session generates a unique key, so even if one session were compromised, others remain secure.",
            "## Data Encryption",
            "File data is chunked and encrypted using AES-256-GCM with unique nonces per chunk. GCM mode provides both confidentiality and integrity — if any byte is tampered with in transit, the decryption will fail and the transfer is aborted.",
            "Metadata like file names and sizes are also encrypted within the session, so a network observer can't even see what files are being transferred.",
            "## Verification",
            "Both devices display a short verification code derived from the session key. Users can optionally compare these codes to confirm they're connected to the right device — similar to Signal's safety numbers.",
            "All of this happens transparently. Users just drag and drop files — the encryption is invisible but always active.",
        ],
    },
    {
        slug: "zero-config-device-discovery",
        coverImage: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&h=450&fit=crop",
        title: "Zero-Config Device Discovery with mDNS",
        description:
            "How Hyper Connect uses mDNS/Bonjour to find devices on your local network automatically — no manual IP addresses or port forwarding needed.",
        date: "2026-02-05",
        author: "Rajeshwar Kashyap",
        tags: ["Engineering", "Networking"],
        readTime: "5 min read",
        content: [
            "One of Hyper Connect's core principles is zero configuration. You shouldn't need to know IP addresses, open ports, or edit config files just to share a file with the laptop next to you.",
            "## What is mDNS?",
            "Multicast DNS (mDNS) is a protocol that resolves hostnames to IP addresses on small networks without a dedicated DNS server. It's the protocol behind Apple's Bonjour and is supported natively on macOS, and via Avahi on Linux. On Windows, we bundle a lightweight mDNS responder.",
            "When Hyper Connect starts, it announces itself on the local network by publishing a service record. Other Hyper Connect instances listening for the same service type will discover it automatically.",
            "## Service Announcement",
            "Each device publishes a DNS-SD (Service Discovery) record with a unique instance name, the device's hostname, the port it's listening on, and a TXT record containing metadata like the device platform and Hyper Connect version.",
            "## Discovery Flow",
            "When the app launches, it performs a one-shot mDNS query for all Hyper Connect service instances. It then subscribes to continuous updates so new devices appearing on the network are detected in real-time.",
            "The typical discovery latency is under 500ms on most networks. On congested networks with many multicast devices, we implement exponential backoff to avoid flooding the network.",
            "## Handling Edge Cases",
            "Network changes (switching Wi-Fi, VPN toggling, etc.) can cause mDNS to temporarily fail. Hyper Connect handles this by re-announcing and re-querying whenever a network interface change is detected.",
            "We also handle duplicate announcements, stale records, and devices that disappear without a proper goodbye packet — common issues on real-world networks.",
            "The result: open Hyper Connect on two machines on the same network, and they find each other instantly. No setup required.",
        ],
    },
    {
        slug: "cross-platform-electron-challenges",
        coverImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=450&fit=crop",
        title: "Building a Cross-Platform Desktop App with Electron",
        description:
            "Lessons learned building Hyper Connect's desktop app for macOS, Windows, and Linux — from native integrations to platform-specific quirks.",
        date: "2026-02-01",
        author: "Rajeshwar Kashyap",
        tags: ["Engineering", "Desktop"],
        readTime: "7 min read",
        content: [
            "Hyper Connect ships on three platforms: macOS, Windows, and Linux. We chose Electron not because it's trendy, but because it let us share 95% of our UI code while still accessing native OS features.",
            "## Why Electron",
            "For a networking tool, native integrations matter — system tray, notifications, file system access, and auto-launch on boot. Electron gives us all of these without maintaining three separate codebases.",
            "The trade-off is bundle size and memory usage. We've invested heavily in optimizing both. The final installer is under 80MB on all platforms, and idle memory usage stays below 100MB.",
            "## Platform-Specific Challenges",
            "macOS was the smoothest experience. Bonjour (mDNS) works out of the box, the system tray API is solid, and code signing with Apple's notarization service is well-documented.",
            "Windows required the most workarounds. mDNS needed a bundled responder since Windows doesn't ship one by default. The system tray behavior differs across Windows 10 and 11. Auto-launch required registry modifications rather than a login item.",
            "Linux was the wildcard. Different distributions handle trays, notifications, and autostart differently. We test against Ubuntu, Fedora, and Arch to cover the major bases. Avahi provides mDNS support but needs to be installed separately on minimal distributions.",
            "## Auto-Updates",
            "We use electron-updater with GitHub Releases as the update backend. Each platform has its own update flow: DMG replacement on macOS, NSIS installer on Windows, and AppImage delta updates on Linux.",
            "Updates are checked on launch and every 6 hours. Users can disable auto-update in settings. We never force updates — the app works fine on older versions, though we recommend staying current for security patches.",
            "## Lessons Learned",
            "Test on real hardware, not just CI. Many platform-specific bugs only appear on actual user machines. Invest in crash reporting early — we added Sentry integration after launch and immediately caught issues we hadn't seen in testing. Keep the main process lean — heavy work belongs in worker threads or the renderer.",
        ],
    },
];

export function getBlogPost(slug: string): BlogPost | undefined {
    return blogPosts.find((post) => post.slug === slug);
}

export function getAllSlugs(): string[] {
    return blogPosts.map((post) => post.slug);
}
