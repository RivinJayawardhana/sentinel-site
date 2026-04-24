import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { AgentChatWidget } from "./AgentChatWidget";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col ml-60 transition-all duration-300" id="main-content">
        <AppHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <AgentChatWidget />
    </div>
  );
}
