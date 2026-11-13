'use client';
import { useEffect, useState, useRef } from 'react';
import { api, type User } from '../../lib/api';
import { useSession } from '../../components/session';
import { Protected } from '../../components/protected';

export default function Page() {
  return (
    <Protected>
      <ProfileContent />
    </Protected>
  );
}

function ProfileContent() {
  const { user: sessionUser, refresh } = useSession();
  const [user, setUser] = useState<User | null>(sessionUser);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!sessionUser);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (sessionUser) {
      setUser(sessionUser);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void api<{ user: User }>('/auth/me', { signal: controller.signal })
      .then(data => setUser(data.user))
      .catch(e => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Session expired');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sessionUser]);

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      await refresh();
      window.location.assign('/login');
    } catch {
      setError('Logout failed');
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB');
      return;
    }
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api<{ user: User; message: string }>('/auth/profile-picture', {
        method: 'POST',
        body: formData,
      });
      setUser(res.user);
      await refresh();
      setUploadSuccess('Profile picture updated successfully!');
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Cloudinary upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemovePhoto() {
    if (!window.confirm('Remove profile picture?')) return;
    setUploading(true);
    setUploadError('');
    try {
      const res = await api<{ user: User; message: string }>('/auth/profile-picture', {
        method: 'DELETE',
      });
      setUser(res.user);
      await refresh();
      setUploadSuccess('Profile picture removed');
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not remove profile picture');
    } finally {
      setUploading(false);
    }
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <main className="page-wrap max-w-3xl">
      {loading ? (
        <div className="surface-panel py-12 text-center text-slate-500">Loading student profile…</div>
      ) : error ? (
        <div className="surface-panel py-10 text-center text-red-600" role="alert">{error}</div>
      ) : user ? (
        <div className="surface-panel shadow-sm">
          {/* Header brought inside the box */}
          <div className="profile-header-banner">
            <span className="section-eyebrow">YOUR CAMPUS IDENTITY</span>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">Student profile</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your account, profile photo, and verification details.</p>
          </div>

          {/* Two-column layout: details on left, Cloudinary profile picture on right */}
          <div className="flex flex-col-reverse md:flex-row items-center md:items-start justify-between gap-8 pt-2">
            {/* Left side: Profile details */}
            <div className="flex-1 space-y-3.5 w-full text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-32 shrink-0">Name:</span>
                <span className="font-bold text-slate-800 text-base">{user.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-32 shrink-0">Email:</span>
                <span className="text-slate-800 font-medium">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-32 shrink-0">Department:</span>
                <span className="text-slate-800">{user.department ?? 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-32 shrink-0">Graduation year:</span>
                <span className="text-slate-800">{user.graduationYear ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-32 shrink-0">Verification:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  user.verificationStatus === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {user.verificationStatus === 'verified' ? '✓ verified' : user.verificationStatus}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-500 w-32 shrink-0">Account:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  user.status === 'active'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {user.status}
                </span>
              </div>

              <div className="pt-4">
                <button
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors cursor-pointer"
                  onClick={logout}
                >
                  Log out
                </button>
              </div>
            </div>

            {/* Right side: Profile picture using Cloudinary */}
            <div className="profile-avatar-container shrink-0">
              <div className="relative group">
                {user.profilePicture?.url ? (
                  <img
                    src={user.profilePicture.url}
                    alt={user.name}
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {initials}
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    Uploading…
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="mt-4 flex flex-col gap-2 w-full">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Uploading to Cloudinary…' : user.profilePicture?.url ? 'Change photo' : 'Upload photo'}
                </button>

                {user.profilePicture?.url && (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={handleRemovePhoto}
                    className="w-full text-xs text-rose-600 hover:text-rose-800 font-medium py-1 cursor-pointer disabled:opacity-50"
                  >
                    Remove photo
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                ☁️ Cloudinary image (max 5 MB)
              </p>

              {uploadError && (
                <p className="text-xs text-red-600 mt-2 font-medium" role="alert">
                  {uploadError}
                </p>
              )}
              {uploadSuccess && (
                <p className="text-xs text-emerald-600 mt-2 font-medium">
                  {uploadSuccess}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
