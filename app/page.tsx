import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase mb-4">
          FIFA World Cup 2026
        </p>
        <h1 className="text-5xl font-bold text-white mb-6">
          🏟️ Smart Stadium Companion
        </h1>
        <p className="text-lg text-gray-300 mb-10">
          GenAI-powered assistant for fans, staff, and volunteers.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/fan"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
          >
            Fan App →
          </Link>
          <Link
            href="/ops"
            className="px-6 py-3 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors"
          >
            Ops Console →
          </Link>
        </div>
        <p className="mt-12 text-xs text-gray-400">
          ⚠️ All live data is simulated for this demo.
        </p>
      </div>
    </main>
  );
}
