import { useState } from "react";
import { ArrowLeft, ChevronRight, LogOut } from "lucide-react";
import { Screen } from "../types";

interface SettingsScreenProps {
  onNavigate: (screen: Screen) => void;
  email: string;
  onSignOut: () => void;
}

export default function SettingsScreen({ onNavigate, email, onSignOut }: SettingsScreenProps) {
  const [pushNotification, setPushNotification] = useState(true);

  // Fallback to default if empty
  const userDisplayEmail = email || "john@example.com";
  // Extrac initials from email or fallback to "JD"
  const initials = userDisplayEmail.slice(0, 2).toUpperCase();

  const handleSignOutClick = () => {
    onSignOut();
    onNavigate(Screen.SignIn);
  };

  return (
    <div id="settings-container" className="bg-surface min-h-screen flex flex-col items-center w-full max-w-md mx-auto relative pb-20">
      {/* TopAppBar */}
      <header className="w-full sticky top-0 z-40 bg-surface border-b border-line flex items-center px-page h-14">
        <button
          onClick={() => onNavigate(Screen.Inbox)}
          aria-label="Go back"
          className="mr-4 p-2 rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-[#1d7a5c]" />
        </button>
        <h1 className="font-bold text-lg text-on-surface font-inter">Settings</h1>
      </header>

      {/* Main Content Canvas */}
      <main className="w-full px-page pt-4 pb-12 flex flex-col gap-6 overflow-y-auto">
        {/* User Profile Card */}
        <section className="bg-white border border-line rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-primary-soft flex items-center justify-center text-[#1d7a5c] font-bold text-lg select-none">
            {initials}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base text-ink font-inter">John Doe</span>
            <span className="text-xs text-muted-ink font-inter mt-0.5">{userDisplayEmail}</span>
          </div>
        </section>

        {/* Preferences Section */}
        <div>
          <h2 className="px-1 mb-2 text-xs font-bold text-[#1d7a5c] uppercase tracking-wider">
            Preferences
          </h2>
          <div className="bg-white border border-line rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors cursor-pointer select-none">
              <div 
                onClick={() => setPushNotification(!pushNotification)}
                className="flex flex-col flex-1 pr-4"
              >
                <span className="font-bold text-sm text-[#1a1c1b] font-inter">Push notifications</span>
                <p className="text-xs text-muted-ink font-inter mt-1">
                  Enable message and agent status alerts.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={pushNotification}
                  onChange={(e) => setPushNotification(e.target.checked)}
                />
                <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:bg-[#1d7a5c] transition-colors relative">
                  <div className={`absolute top-[2px] bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${
                    pushNotification ? "left-[24px]" : "left-[2px]"
                  }`} />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Security Section (Direct link to CONNECTORS card) */}
        <div>
          <h2 className="px-1 mb-2 text-xs font-bold text-[#1d7a5c] uppercase tracking-wider">
            Security
          </h2>
          <div className="bg-white border border-line rounded-xl overflow-hidden shadow-xs">
            <button
              onClick={() => onNavigate(Screen.Connectors)}
              className="w-full p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors text-left active:scale-[0.99] transition-transform cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#1a1c1b] font-inter">Connectors</span>
                <p className="text-xs text-muted-ink font-inter mt-1">
                  Review accounts approved for backend access.
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-outline shrink-0" />
            </button>
          </div>
        </div>

        {/* Privacy Section */}
        <div>
          <h2 className="px-1 mb-2 text-xs font-bold text-[#1d7a5c] uppercase tracking-wider font-inter">
            Privacy
          </h2>
          <div className="bg-white border border-line rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 flex flex-col gap-1">
              <span className="font-bold text-sm text-[#1a1c1b] font-inter">Session storage</span>
              <p className="text-xs text-muted-ink font-inter leading-relaxed mt-0.5">
                This app stores only your Sydney session token on device.
              </p>
            </div>
          </div>
        </div>

        {/* Sign Out CTA & Encryption Slogan */}
        <div className="mt-4">
          <button
            onClick={handleSignOutClick}
            className="w-full py-3.5 px-4 rounded-xl border border-danger-soft text-danger font-bold text-sm flex items-center justify-center gap-2 hover:bg-danger-soft transition-colors active:scale-95 transition-transform cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-danger" />
            Sign out
          </button>
          
          <p className="text-center mt-8 text-xs text-subtle-ink font-inter whitespace-pre-line leading-relaxed">
            Sydney Agent v1.2.4{"\n"}
            Encryption active
          </p>
        </div>
      </main>
    </div>
  );
}
