"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { useRef, useCallback, useState, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Code,
  Code2,
  Minus,
  Upload,
} from "lucide-react";
import { uploadToBunny, isBase64Image } from "@/lib/bunny";

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function TipTapEditor({ content, onChange, placeholder = "เริ่มเขียนเนื้อหา..." }: TipTapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasUnsupportedTags = /<\s*(table|thead|tbody|tr|th|td|dl|dt|dd)\b|class\s*=\s*["']lead["']/i.test(content);
  const [mode, setMode] = useState<"visual" | "html">(hasUnsupportedTags ? "html" : "visual");
  const [htmlDraft, setHtmlDraft] = useState(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto my-4",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlDraft(html);
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "article-content max-w-none min-h-[400px] p-6 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    setHtmlDraft(content);
  }, [content]);

  const switchToVisual = useCallback(() => {
    if (editor && htmlDraft !== editor.getHTML()) {
      editor.commands.setContent(htmlDraft, { emitUpdate: false });
    }
    setMode("visual");
  }, [editor, htmlDraft]);

  const switchToHtml = useCallback(() => {
    if (editor) setHtmlDraft(editor.getHTML());
    setMode("html");
  }, [editor]);

  const addImage = useCallback(async (file: File) => {
    if (!editor) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      
      // Upload to Bunny CDN
      try {
        let imageUrl = base64;
        if (isBase64Image(base64)) {
          imageUrl = await uploadToBunny(base64, "articles/content", `img-${Date.now()}.jpg`);
        }
        
        editor.chain().focus().setImage({ src: imageUrl }).run();
      } catch (error) {
        console.error("Failed to upload image:", error);
        // Fallback to base64 if upload fails
        editor.chain().focus().setImage({ src: base64 }).run();
      }
    };
    reader.readAsDataURL(file);
  }, [editor]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addImage(file);
    }
    e.target.value = "";
  }, [addImage]);

  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        isActive
          ? "bg-[#4CAF50] text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1" />;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Mode toggle bar */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={switchToVisual}
            className={`px-3 py-1 rounded-md transition-colors ${
              mode === "visual"
                ? "bg-[#4CAF50] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            มุมมอง
          </button>
          <button
            type="button"
            onClick={switchToHtml}
            className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
              mode === "html"
                ? "bg-[#4CAF50] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> HTML
          </button>
        </div>
        {hasUnsupportedTags && (
          <span className="text-amber-600 text-[11px] flex items-center gap-1">
            ⚠ มี table/dl/lead — โหมด HTML เท่านั้นที่เก็บ tag ครบ
          </span>
        )}
      </div>

      {mode === "html" ? (
        <textarea
          value={htmlDraft}
          onChange={(e) => {
            setHtmlDraft(e.target.value);
            onChange(e.target.value);
          }}
          spellCheck={false}
          className="w-full min-h-[400px] p-4 font-mono text-xs leading-relaxed text-gray-800 bg-gray-50 focus:outline-none resize-y"
          placeholder="<p>เนื้อหา HTML...</p>"
        />
      ) : (
        <>
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap items-center gap-0.5">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="ย้อนกลับ"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="ทำซ้ำ"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="หัวข้อใหญ่"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="หัวข้อรอง"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="หัวข้อย่อย"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="ตัวหนา"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="ตัวเอียง"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="ขีดเส้นใต้"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="ขีดฆ่า"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title="โค้ด"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          title="ชิดซ้าย"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          title="กึ่งกลาง"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          title="ชิดขวา"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="รายการแบบจุด"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="รายการแบบตัวเลข"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="คำพูด"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="เส้นคั่น"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Link & Image */}
        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          title="ลิงก์"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          title="แทรกรูปภาพ"
        >
          <ImageIcon className="w-4 h-4" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} className="bg-white" />
        </>
      )}

      {/* Status Bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {mode === "html"
            ? `${htmlDraft.length} ตัวอักษร (HTML)`
            : `${editor.storage.characterCount?.characters?.() || 0} ตัวอักษร`}
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          พร้อมใช้งาน
        </span>
      </div>
    </div>
  );
}
