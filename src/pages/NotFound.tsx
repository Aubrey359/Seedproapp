import { Link } from "react-router";
import { FiArrowLeft } from "react-icons/fi";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-seed-cream flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-xl bg-seed-green/10 flex items-center justify-center mb-4">
        <span className="text-3xl">🌱</span>
      </div>
      <h1 className="font-display text-2xl font-bold text-seed-brown mb-2">Page Not Found</h1>
      <p className="text-sm text-text-secondary text-center mb-6 max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-6 py-3 bg-seed-green text-white text-sm font-semibold rounded-xl"
      >
        <FiArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>
    </div>
  );
}
