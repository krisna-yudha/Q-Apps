import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Phone,
  Building2,
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Camera,
  Trash2,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { api } from '../../services/api';

export const ProfileModal = ({ isOpen, onClose, initialTab = 'profile' }) => {
  const { user, updateUser } = useAuth();
  const { triggerDataUpdate } = useSync();
  const [activeTab, setActiveTab] = useState(initialTab); // 'profile' | 'password'

  // Profile Form States
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [avatarColor, setAvatarColor] = useState('navy');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarData, setAvatarData] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState(null);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setDepartment(user.department || 'Contact Center Operations');
      setAvatarColor(user.avatar_color || 'navy');
      setAvatarPreview(user.avatar || null);
      setAvatarData(null);
      setRemoveAvatar(false);
      setCompressionInfo(null);
    }
    setActiveTab(initialTab);
    setStatus({ type: '', message: '' });
  }, [user, isOpen, initialTab]);

  if (!isOpen) return null;

  // Ultra-lightweight HTML5 Canvas Image Compression (~15KB-30KB)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', message: 'Hanya file gambar (JPG, PNG, WEBP) yang didukung.' });
      return;
    }

    const originalSizeKb = Math.round(file.size / 1024);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.82 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        const compressedSizeKb = Math.round((compressedBase64.length * 3 / 4) / 1024);
        const reductionPercent = originalSizeKb > 0 ? Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100) : 0;

        setAvatarPreview(compressedBase64);
        setAvatarData(compressedBase64);
        setRemoveAvatar(false);
        setCompressionInfo({
          originalSizeKb,
          compressedSizeKb,
          reductionPercent: Math.max(0, reductionPercent)
        });
        setStatus({ type: 'info', message: `Foto terkompresi otomatis: ${originalSizeKb} KB → ${compressedSizeKb} KB (Hemat ${Math.max(0, reductionPercent)}% ukuran).` });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarPreview(null);
    setAvatarData(null);
    setRemoveAvatar(true);
    setCompressionInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const colorOptions = [
    { id: 'navy', name: 'Navy Blue', bg: 'bg-[#0F2744]', ring: 'ring-[#0F2744]' },
    { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-600', ring: 'ring-indigo-600' },
    { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-600', ring: 'ring-emerald-600' },
    { id: 'amber', name: 'Amber', bg: 'bg-amber-600', ring: 'ring-amber-600' },
    { id: 'purple', name: 'Purple', bg: 'bg-purple-600', ring: 'ring-purple-600' },
    { id: 'rose', name: 'Rose', bg: 'bg-rose-600', ring: 'ring-rose-600' },
  ];

  const getRoleLabel = (role) => {
    switch (role) {
      case 'supervisor': return 'Supervisor QA';
      case 'quality_assurance': return 'Quality Assurance';
      case 'team_leader': return 'Team Leader';
      default: return 'User';
    }
  };

  const getAvatarBg = (color) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-600';
      case 'emerald': return 'bg-emerald-600';
      case 'amber': return 'bg-amber-600';
      case 'purple': return 'bg-purple-600';
      case 'rose': return 'bg-rose-600';
      default: return 'bg-[#0F2744]';
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const payload = {
        user_id: user.id,
        name,
        username,
        email,
        phone,
        department,
        avatar_color: avatarColor,
        remove_avatar: removeAvatar ? 1 : 0
      };

      if (avatarData) {
        payload.avatar = avatarData;
      }

      const res = await api.updateProfile(payload);

      if (res.success && res.user) {
        updateUser(res.user);
        triggerDataUpdate();
        setStatus({ type: 'success', message: 'Data profil & foto berhasil disimpan!' });
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Gagal menyimpan profil.';
      setStatus({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirmation) {
      setStatus({ type: 'error', message: 'Konfirmasi kata sandi baru tidak cocok.' });
      return;
    }

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const res = await api.updatePassword({
        user_id: user.id,
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirmation
      });

      if (res.success) {
        setStatus({ type: 'success', message: 'Kata sandi berhasil diperbarui!' });
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirmation('');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      const msg = err.response?.data?.errors?.current_password?.[0] || err.response?.data?.message || 'Gagal memperbarui kata sandi.';
      setStatus({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${getAvatarBg(avatarColor)} text-white flex items-center justify-center font-bold text-base shadow-sm overflow-hidden`}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{name ? name.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pengaturan Akun & Profil</h3>
              <p className="text-xs text-slate-500 font-medium">
                Sesuaikan identitas, foto profil, dan keamanan akun Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 pt-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('profile'); setStatus({ type: '', message: '' }); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-[#0F2744] text-[#0F2744] bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Data Diri & Foto</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('password'); setStatus({ type: '', message: '' }); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'password'
                ? 'border-[#0F2744] text-[#0F2744] bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Keamanan & Kata Sandi</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Status Feedback Banner */}
          {status.message && (
            <div className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              status.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700 font-semibold'
                : status.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold'
                : 'bg-blue-50 border border-blue-200 text-blue-800 font-medium'
            }`}>
              {status.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          {/* Tab 1: Profile & Compressed Image Upload */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
              {/* Avatar Upload with Compression */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Avatar Circle Preview */}
                  <div className="relative group mx-auto sm:mx-0 flex-shrink-0">
                    <div className={`w-16 h-16 rounded-full ${getAvatarBg(avatarColor)} text-white flex items-center justify-center font-black text-xl shadow-md overflow-hidden ring-4 ring-white`}>
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Foto Profil" className="w-full h-full object-cover" />
                      ) : (
                        <span>{name ? name.charAt(0).toUpperCase() : 'U'}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Compression Info */}
                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-secondary py-1 px-3 text-xs"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-700" />
                        <span>{avatarPreview ? 'Ganti Foto' : 'Unggah Foto'}</span>
                      </button>

                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition"
                          title="Hapus Foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium">
                      Format JPG, PNG, WEBP. <strong className="text-slate-700">Kompresi otomatis aktif</strong> (hemat storage server).
                    </p>

                    {compressionInfo && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Kompresi: {compressionInfo.originalSizeKb} KB → {compressionInfo.compressedSizeKb} KB (Hemat {compressionInfo.reductionPercent}%)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Avatar Color Picker (when no photo or fallback) */}
                <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Warna Aksen Inisial:</span>
                  <div className="flex items-center gap-1.5">
                    {colorOptions.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAvatarColor(c.id)}
                        className={`w-5 h-5 rounded-full ${c.bg} transition ${
                          avatarColor === c.id ? `ring-2 ring-offset-2 ${c.ring}` : 'opacity-70 hover:opacity-100'
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama lengkap Anda"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username login"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@perusahaan.com"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Departemen / Unit Kerja
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Contoh: Quality Assurance & Monitoring Center"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Role Sistem
                  </label>
                  <div className="py-2 px-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                    {getRoleLabel(user?.role)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan Profil'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Password Form */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
                Gunakan kombinasi minimal 6 karakter dengan huruf dan angka untuk keamanan akun Anda.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kata Sandi Saat Ini <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi lama Anda"
                    className="w-full px-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kata Sandi Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Konfirmasi Kata Sandi Baru <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPasswordConfirmation}
                  onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{loading ? 'Memproses...' : 'Perbarui Kata Sandi'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
