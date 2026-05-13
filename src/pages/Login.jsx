import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { isAuthenticated, loginWithPassword } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLocalLogin = () => {
    setErrorMessage('');
    const ok = loginWithPassword(username, password);
    if (!ok) {
      setErrorMessage('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLocalLogin();
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `
          url('https://tnc-check01.gt.tc/img/logo.png'),
          linear-gradient(135deg, #e0f2fe 0%, #bfdbfe 25%, #93c5fd 50%, #60a5fa 75%, #3b82f6 100%),
          radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(96, 165, 250, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(147, 197, 253, 0.08) 0%, transparent 40%)
        `,
        backgroundPosition: 'center, 0 0, 0 0, 0 0, 0 0',
        backgroundSize: '200px 200px, 100% 100%, 100% 100%, 100% 100%, 100% 100%',
        backgroundRepeat: 'no-repeat, repeat, repeat, repeat, repeat',
        backgroundAttachment: 'fixed',
        opacity: 1
      }}
    >
      {/* Overlay to dim background */}
      <div className="absolute inset-0 bg-black/5 pointer-events-none" />
      {/* SVG Background Pattern */}
      <svg 
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.1 }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="dots" x="50" y="50" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="50" cy="50" r="2" fill="#1e40af" />
          </pattern>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Decorative shapes */}
        <circle cx="0" cy="0" r="200" fill="url(#grad1)" />
        <circle cx="100%" cy="100%" r="250" fill="url(#grad1)" />
        
        {/* Grid pattern */}
        <rect width="100%" height="100%" fill="url(#dots)" />
        
        {/* Geometric lines */}
        <line x1="0" y1="0" x2="100%" y2="20%" stroke="#0284c7" strokeWidth="2" opacity="0.15" />
        <line x1="100%" y1="0" x2="0" y2="100%" stroke="#06b6d4" strokeWidth="3" opacity="0.1" />
        <line x1="0" y1="100%" x2="100%" y2="80%" stroke="#0284c7" strokeWidth="2" opacity="0.15" />
      </svg>

      {/* Main container */}
      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-8">
          {/* Header with Logo */}
          <div className="flex flex-col items-center space-y-4">
            {/* School Logo */}
            {!logoError ? (
              <img 
                src="https://tnc-check01.gt.tc/img/logo.png" 
                alt="logo" 
                className="w-28 h-28 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-28 h-28 bg-gradient-to-br from-yellow-500 to-red-600 rounded-full shadow-lg flex items-center justify-center relative border-4 border-white">
                <div className="text-5xl font-bold text-white drop-shadow-lg">ช</div>
              </div>
            )}

            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-gray-800">เข้าสู่ระบบเช็คชื่อกิจกรรมหน้าเสาธง</h1>
              <p className="text-sm text-gray-500">วิทยาลัยเทคนิคจันทบุรี</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Username Field */}
            <div className="relative">
              <div className="absolute left-3 top-3.5 text-gray-400">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="ชื่อผู้ใช้"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all text-gray-700 placeholder-gray-400"
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <div className="absolute left-3 top-3.5 text-gray-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="รหัสผ่าน"
                className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all text-gray-700 placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Error message */}
            {errorMessage && (
              <p className="text-sm text-red-500 text-center bg-red-50 px-3 py-2 rounded-lg">{errorMessage}</p>
            )}

            {/* Login Button */}
            <button
              onClick={handleLocalLogin}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              เข้าสู่ระบบเพื่อเช็คชื่อ
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sm text-gray-600 space-y-1">
        <p>วิทยาลัยเทคนิคจันทบุรี</p>
        <p className="text-xs text-gray-500">งานกิจกรรมนักเรียน นักศึกษา</p>
      </div>
    </div>
  );
}
