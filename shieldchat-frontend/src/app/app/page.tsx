"use client";

export default function AppDashboard() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-950 to-purple-950/20 p-4">
      <div className="text-center max-w-lg px-4">
        {/* Animated shield icon */}
        <div className="relative inline-block mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/30">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-3 border-gray-950">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          Welcome to <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">ShieldChat</span>
        </h2>
        <p className="text-gray-400 mb-6 leading-relaxed">
          Your secure, decentralized messaging hub. Select a channel from the sidebar or create a new one to start messaging privately.
        </p>

        {/* Getting started tips */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-5 border border-gray-700/50 text-left">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Getting Started
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span className="text-gray-400">Create a channel or join an existing one</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span className="text-gray-400">Invite members with shareable links</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span className="text-gray-400">Send encrypted messages with payments</span>
            </li>
          </ul>
        </div>

        {/* Feature highlights - hidden on smaller screens */}
        <div className="mt-5 hidden lg:grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/50">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 mx-auto mb-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="text-xs text-gray-400">Encrypted</div>
          </div>
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/50">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 mx-auto mb-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-xs text-gray-400">Private Pay</div>
          </div>
          <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/50">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div className="text-xs text-gray-400">Token Gated</div>
          </div>
        </div>
      </div>
    </div>
  );
}
