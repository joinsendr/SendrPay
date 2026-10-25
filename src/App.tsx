import { useEffect, useState } from "react";
import { SplashScreen } from "./components/SplashScreen";
import { BottomNavigation } from "./components/BottomNavigation";
import { HomeScreen } from "./screens/HomeScreen";
import { WalletScreen } from "./screens/WalletScreen";
import { PayScreen } from "./screens/PayScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WalletProvider } from "./context/WalletContext";
import type { TabKey } from "./types";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("home");

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <WalletProvider>
      <div className="min-h-screen bg-neutral-100 sm:flex sm:items-center sm:justify-center sm:py-10">
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-white sm:min-h-[48rem] sm:max-w-sm sm:rounded-[2.5rem] sm:border sm:border-neutral-200 sm:shadow-2xl">
          <main className="flex-1 overflow-y-auto">
            {activeTab === "home" && (
              <HomeScreen onNavigate={setActiveTab} onOpenPay={() => setActiveTab("pay")} />
            )}
            {activeTab === "wallet" && <WalletScreen />}
            {activeTab === "pay" && <PayScreen />}
            {activeTab === "settings" && <SettingsScreen />}
          </main>
          <BottomNavigation active={activeTab} onChange={setActiveTab} />
        </div>

        <SplashScreen visible={showSplash} />
      </div>
    </WalletProvider>
  );
}

export default App;
