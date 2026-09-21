import React from 'react';

type ImageDetail = { name?: string; description?: string };

interface AdminImageDetailsManagerProps {
  images: string[];
  imageDetails: Record<string, ImageDetail>;
  onChange: (details: Record<string, ImageDetail>) => void;
  /** Shown as each field's placeholder, so it's obvious what an unset image falls back to. */
  defaultName: string;
  defaultDescription: string;
}

// Optional per-image name/description override - an admin who never touches this gets exactly
// today's behavior (every image effectively uses the product's own name/description), since an
// image only gets an entry in `imageDetails` once at least one field on it is actually filled in.
const AdminImageDetailsManager: React.FC<AdminImageDetailsManagerProps> = ({ images, imageDetails, onChange, defaultName, defaultDescription }) => {
  if (images.length === 0) return null;

  const updateDetail = (url: string, field: keyof ImageDetail, value: string) => {
    const next = { ...(imageDetails[url] ?? {}), [field]: value };
    const updated = { ...imageDetails };
    if (!next.name?.trim() && !next.description?.trim()) {
      delete updated[url];
    } else {
      updated[url] = next;
    }
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-emerald-300">Per-image name &amp; description (optional)</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Leave blank to use the product's own name/description for that photo.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {images.map((url) => {
          const detail = imageDetails[url];
          const isCustomized = !!(detail?.name?.trim() || detail?.description?.trim());
          return (
            <div key={url} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex gap-3">
              <img src={url} alt="" className="w-14 h-14 rounded-lg object-contain bg-white border border-slate-100 dark:border-slate-800 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <input
                  type="text"
                  value={detail?.name ?? ''}
                  onChange={(e) => updateDetail(url, 'name', e.target.value)}
                  placeholder={defaultName}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <textarea
                  value={detail?.description ?? ''}
                  onChange={(e) => updateDetail(url, 'description', e.target.value)}
                  placeholder={defaultDescription || 'Description (optional)'}
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"
                />
                {isCustomized && <span className="text-[10px] font-bold text-emerald-600">Custom</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminImageDetailsManager;
