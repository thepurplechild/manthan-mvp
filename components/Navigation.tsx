import Link from 'next/link'
import { AuthButton } from './auth-button'

export default function Navigation() {
  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="ml-3 text-xl font-semibold text-gray-900">Manthan</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/projects/new" 
              className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Projects
            </Link>
            <Link 
              href="/projects/new"
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-all duration-200"
            >
              Upload Script
            </Link>
            <AuthButton />
          </div>
        </div>
      </div>
    </nav>
  );
}