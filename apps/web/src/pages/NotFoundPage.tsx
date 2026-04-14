import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-brand-200">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
