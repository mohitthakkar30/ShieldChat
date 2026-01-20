"use client";

export default function AppDashboard() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="text-6xl mb-6">💬</div>
        <h2 className="text-2xl font-bold mb-2">Welcome to ShieldChat</h2>
        <p className="text-gray-400 max-w-md">
          Select a channel from the sidebar or create a new one to start
          messaging securely.
        </p>
      </div>
    </div>
  );
}
