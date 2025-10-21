import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { MobileBottomNav } from "./MobileBottomNav";
import { FloatingActionButton } from "./FloatingActionButton";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - works on both mobile and desktop */}
      <Sidebar />
      
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between lg:justify-end">
            {/* Spacer for mobile hamburger button */}
            <div className="w-10 lg:hidden"></div>
            <ThemeToggle />
          </div>
        </div>
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      
      {/* Floating Action Button */}
      <FloatingActionButton />
    </div>
  );
};
