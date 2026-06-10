/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import SplashScreen from "./components/SplashScreen";
import SignInScreen from "./components/SignInScreen";
import SignUpScreen from "./components/SignUpScreen";
import ForgotPasswordScreen from "./components/ForgotPasswordScreen";
import InboxScreen from "./components/InboxScreen";
import NewAgentScreen from "./components/NewAgentScreen";
import ConfirmAgentScreen from "./components/ConfirmAgentScreen";
import SetupTrackerScreen from "./components/SetupTrackerScreen";
import ConnectorsScreen from "./components/ConnectorsScreen";
import ScoutChatScreen from "./components/ScoutChatScreen";
import SettingsScreen from "./components/SettingsScreen";

import { Screen, AgentThread } from "./types";
import { INITIAL_THREADS } from "./data";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.Splash);
  const [email, setEmail] = useState("elementary221b@gmail.com");
  const [agentPrompt, setAgentPrompt] = useState(
    "Summarize the key points from recent meetings and prepare a draft agenda for tomorrow."
  );
  const [threads, setThreads] = useState<AgentThread[]>(INITIAL_THREADS);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("scout");

  const handleSignOut = () => {
    setEmail("");
    setAgentPrompt("");
    // Reset threads on logout to default pre-configured list
    setThreads(INITIAL_THREADS);
  };

  const handleCreateAgentThread = () => {
    // When agent is approved, dynamically insert their custom agent to the live inbox threads list
    const newThread: AgentThread = {
      id: "custom-" + Date.now(),
      name: "Custom Agent",
      initials: "C",
      colorClass: "bg-[#8b5cf6] text-white",
      preview: "Setup checklist finalized.",
      detail: agentPrompt.length > 50 ? agentPrompt.substring(0, 48) + "..." : agentPrompt,
      isPinned: false,
    };
    setThreads((prev) => [newThread, ...prev]);
  };

  // Safe router screen rendering
  const renderScreen = () => {
    switch (currentScreen) {
      case Screen.Splash:
        return <SplashScreen onComplete={() => setCurrentScreen(Screen.SignIn)} />;
      case Screen.SignIn:
        return (
          <SignInScreen
            onNavigate={setCurrentScreen}
            onSetEmail={setEmail}
          />
        );
      case Screen.SignUp:
        return (
          <SignUpScreen
            onNavigate={setCurrentScreen}
            onSetEmail={setEmail}
          />
        );
      case Screen.ForgotPassword:
        return <ForgotPasswordScreen onNavigate={setCurrentScreen} />;
      case Screen.Inbox:
        return (
          <InboxScreen
            threads={threads}
            onNavigate={setCurrentScreen}
            onSelectThread={setSelectedThreadId}
          />
        );
      case Screen.NewAgent:
        return (
          <NewAgentScreen
            onNavigate={setCurrentScreen}
            agentPrompt={agentPrompt}
            setAgentPrompt={setAgentPrompt}
          />
        );
      case Screen.ConfirmAgent:
        return (
          <ConfirmAgentScreen
            onNavigate={setCurrentScreen}
            agentPrompt={agentPrompt}
          />
        );
      case Screen.SetupTracker:
        // Automatically inject customized agent setup thread into thread state
        const handleNavigateFromTracker = (nextScreen: Screen) => {
          handleCreateAgentThread();
          setCurrentScreen(nextScreen);
        };
        return <SetupTrackerScreen onNavigate={handleNavigateFromTracker} />;
      case Screen.Connectors:
        return <ConnectorsScreen onNavigate={setCurrentScreen} />;
      case Screen.ScoutChat:
        return <ScoutChatScreen onNavigate={setCurrentScreen} />;
      case Screen.Settings:
        return (
          <SettingsScreen
            onNavigate={setCurrentScreen}
            email={email}
            onSignOut={handleSignOut}
          />
        );
      default:
        return <SplashScreen onComplete={() => setCurrentScreen(Screen.SignIn)} />;
    }
  };

  return (
    <div id="workspace-container" className="min-h-screen bg-surface-dim flex items-center justify-center p-0 md:p-6 transition-all">
      {/* 
        A highly stylized, centered device frame mock representation for desktops 
        that renders as seamless fullscreen on standard mobile viewports.
      */}
      <div 
        id="phone-device-frame" 
        className="w-full md:max-w-md h-screen md:h-[880px] bg-background md:rounded-[36px] md:shadow-2xl overflow-hidden border border-line md:border-outline/20 relative flex flex-col"
      >
        {/* Device Notch simulation for premium aesthetic look (desktops only) */}
        <div id="device-notch-mask" className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-[#1a1c1b] rounded-b-xl z-50"></div>
        
        {/* Render Active Routed Canvas Content */}
        <div id="canvas-content-wrapper" className="flex-1 overflow-hidden relative flex flex-col">
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}
