/**
 * Accent color palette.
 *
 * Each entry provides the `--primary` value for light mode and dark mode
 * separately, taken directly from the App.css design-system tokens.
 * `swatch` is the color used to render the picker button — we use the light
 * value so it always looks vivid regardless of the current theme.
 */
export interface AccentColor {
	name: string;
	light: string;
	dark: string;
	swatch: string;
}

export const ACCENT_COLORS: AccentColor[] = [
	{
		name: "Violet",
		light: "oklch(0.6333 0.2309 304.9039)",
		dark: "oklch(0.6333 0.2309 304.9039)",
		swatch: "oklch(0.6333 0.2309 304.9039)",
	},
	{
		name: "Blue",
		light: "oklch(0.5624 0.1743 260.1433)",
		dark: "oklch(0.6200 0.1743 260.1433)",
		swatch: "oklch(0.5624 0.1743 260.1433)",
	},
	{
		name: "Green",
		light: "oklch(0.6744 0.1427 156.0110)",
		dark: "oklch(0.7200 0.1427 156.0110)",
		swatch: "oklch(0.6744 0.1427 156.0110)",
	},
	{
		name: "Orange",
		light: "oklch(0.7209 0.1489 60.9474)",
		dark: "oklch(0.7600 0.1489 60.9474)",
		swatch: "oklch(0.7209 0.1489 60.9474)",
	},
];

export const DEFAULT_ACCENT = "Violet";

export function getAccentColor(name: string): AccentColor {
	return (
		ACCENT_COLORS.find((c) => c.name === name) ??
		ACCENT_COLORS[0]
	);
}
