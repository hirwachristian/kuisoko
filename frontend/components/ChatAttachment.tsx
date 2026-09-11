import React from 'react';
import { FileText, Download } from 'lucide-react';

const FRIENDLY_LABELS: Record<string, string> = {
  'application/pdf': 'PDF document',
  'application/msword': 'Word document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
  'application/vnd.ms-excel': 'Excel spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel spreadsheet',
  'text/plain': 'Text file',
  'application/zip': 'ZIP archive',
};

interface ChatAttachmentProps {
  url: string;
  type: string | null;
  name: string | null;
}

/** Renders one chat attachment - inline for images, a small file chip (name + download icon)
 * for anything else. Shared by ChatWidget (customer) and AdminMessages (admin) so both sides
 * render attachments identically. */
const ChatAttachment: React.FC<ChatAttachmentProps> = ({ url, type, name }) => {
  const isImage = type?.startsWith('image/') ?? false;

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-1.5 -mx-0.5">
        <img src={url} alt={name ?? 'Attachment'} className="rounded-lg max-h-56 w-auto max-w-full object-cover" />
      </a>
    );
  }

  const label = name ?? (type ? FRIENDLY_LABELS[type] : undefined) ?? 'File';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 mb-1.5 hover:bg-black/10 transition-colors max-w-full"
    >
      <FileText size={18} className="shrink-0 opacity-70" />
      <span className="text-xs truncate flex-1 font-medium">{label}</span>
      <Download size={14} className="shrink-0 opacity-70" />
    </a>
  );
};

export default ChatAttachment;
