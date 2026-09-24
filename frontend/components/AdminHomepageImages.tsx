import React, { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, Upload, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { apiFetch, ApiError } from '../api';
import { useAppContext } from '../context/AppContext';

interface SiteImage {
  id: string;
  url: string;
  createdAt: string;
}

// Admin-manageable replacement for the hardcoded HERO_SLIDES/ABOUT_IMAGES arrays previously baked
// into Home.tsx/AboutSection.tsx: upload into one shared pool, then independently choose which
// pool images show in each section and in what order. Mirrors AdminManageProducts.tsx's
// handleImageFileChange for the upload step (POST /uploads per file), but each uploaded URL is
// then also registered as its own site_images row via POST /site-images - uploading and pooling
// are two separate steps, same as every other admin image flow in this app.
const AdminHomepageImages: React.FC = () => {
  const { token, showToast } = useAppContext();
  const [images, setImages] = useState<SiteImage[]>([]);
  const [heroIds, setHeroIds] = useState<string[]>([]);
  const [aboutIds, setAboutIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ images: SiteImage[]; heroImageIds: string[]; aboutImageIds: string[] }>('/site-images', {}, token);
      setImages(data.images);
      setHeroIds(data.heroImageIds);
      setAboutIds(data.aboutImageIds);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not load homepage images.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0 || !token) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const { url } = await apiFetch<{ url: string }>('/uploads', { method: 'POST', body: formData }, token);
        await apiFetch('/site-images', { method: 'POST', body: JSON.stringify({ url }) }, token);
      }
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not upload one or more images.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (image: SiteImage) => {
    if (!token || !window.confirm('Remove this image? It will also come off any section using it.')) return;
    try {
      await apiFetch(`/site-images/${image.id}`, { method: 'DELETE' }, token);
      apiFetch('/uploads', { method: 'DELETE', body: JSON.stringify({ url: image.url }) }, token).catch(() => {});
      setImages((prev) => prev.filter((img) => img.id !== image.id));
      setHeroIds((prev) => prev.filter((id) => id !== image.id));
      setAboutIds((prev) => prev.filter((id) => id !== image.id));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not remove this image.', 'error');
    }
  };

  const saveList = async (section: 'hero' | 'about', next: string[]) => {
    if (!token) return;
    if (section === 'hero') setHeroIds(next); else setAboutIds(next);
    try {
      await apiFetch(`/site-images/${section}`, { method: 'PATCH', body: JSON.stringify({ imageIds: next }) }, token);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save this section.', 'error');
      await load();
    }
  };

  const toggle = (section: 'hero' | 'about', id: string) => {
    const current = section === 'hero' ? heroIds : aboutIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    saveList(section, next);
  };

  const move = (section: 'hero' | 'about', id: string, direction: -1 | 1) => {
    const current = section === 'hero' ? heroIds : aboutIds;
    const index = current.indexOf(id);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= current.length) return;
    const next = [...current];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    saveList(section, next);
  };

  const urlFor = (id: string) => images.find((img) => img.id === id)?.url;

  const OrderList: React.FC<{ title: string; ids: string[]; section: 'hero' | 'about' }> = ({ title, ids, section }) => (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">{title}</h4>
      {ids.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">No images selected - the site shows its default images until you pick some above.</p>
      ) : (
        <div className="space-y-2">
          {ids.map((id, idx) => {
            const url = urlFor(id);
            if (!url) return null;
            return (
              <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <img src={url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">#{idx + 1}</span>
                <button onClick={() => move(section, id, -1)} disabled={idx === 0} className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-emerald-300 disabled:opacity-30">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => move(section, id, 1)} disabled={idx === ids.length - 1} className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-emerald-300 disabled:opacity-30">
                  <ChevronDown size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex justify-center py-14">
        <Loader2 size={24} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-emerald-50 mb-2 flex items-center gap-2"><ImageIcon size={20} /> Homepage Images</h3>
      <p className="text-sm text-slate-500 dark:text-emerald-300 mb-6">
        Upload images here, then choose which ones show in the homepage hero and the About Us section. The same image can be used in both.
      </p>

      <label className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors mb-6">
        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {isUploading ? 'Uploading...' : 'Upload Images'}
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={isUploading} />
      </label>

      {images.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">No images uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {images.map((image) => (
            <div key={image.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-2">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950">
                <img src={image.url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleDelete(image)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 dark:bg-slate-900/90 text-rose-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"
                  aria-label="Remove image"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={heroIds.includes(image.id)} onChange={() => toggle('hero', image.id)} className="accent-emerald-600" />
                  Hero
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={aboutIds.includes(image.id)} onChange={() => toggle('about', image.id)} className="accent-emerald-600" />
                  About Us
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
        <OrderList title="Hero Section Order" ids={heroIds} section="hero" />
        <OrderList title="About Us Order" ids={aboutIds} section="about" />
      </div>
    </div>
  );
};

export default AdminHomepageImages;
