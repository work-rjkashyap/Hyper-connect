import { HomeHeader } from "@/components/home-header";

export default function Layout({
  children,
}: LayoutProps<"/">): React.ReactElement {
  return (
    <>
      <HomeHeader />
      {children}
    </>
  );
}
