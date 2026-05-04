"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import { supabase } from '@/lib/supabase';
import { Plus, GripVertical, Type, List, ListOrdered, Code, Quote, Heading1, Heading2 } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function AdminQuestionPanel({ problem, problemId }: { problem: any, problemId: string }) {
  const [showComponentMenu, setShowComponentMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom');
  const [controlsInfo, setControlsInfo] = useState<{ top: number; blockPos: number } | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
    ],
    content: '',
    editorProps: { attributes: { class: 'tiptap-editor' } },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setShowComponentMenu(false);
      }
    }
    if (showComponentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showComponentMenu]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!editor || showComponentMenu) return;

    const container = containerRef.current;
    if (!container) return;

    const editorEl = container.querySelector('.tiptap-editor');
    if (!editorEl) return;

    const { clientY } = e;
    const children = Array.from(editorEl.children);
    
    let closestBlock = null;
    let minDistance = Infinity;
    let blockIndex = 0;

    children.forEach((child, index) => {
      const rect = child.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const distance = Math.abs(clientY - mid);
      if (distance < minDistance) {
        minDistance = distance;
        closestBlock = child;
        blockIndex = index;
      }
    });

    if (closestBlock) {
      const rect = (closestBlock as HTMLElement).getBoundingClientRect();
      setControlsInfo({
        top: rect.top + 4, // Fine-tuned alignment to match first line of text
        blockPos: blockIndex
      });
    }
  };

  const toggleMenu = () => {
    if (!showComponentMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 250px below, force the menu to open upwards
      setMenuPosition(spaceBelow < 250 ? 'top' : 'bottom');
    }
    setShowComponentMenu(!showComponentMenu);
  };

  const addComponent = (type: string) => {
    if (!editor) return;
    // Implementation of adding block at controlsInfo.blockPos
    setShowComponentMenu(false);
  };

  return (
    <div 
      ref={containerRef}
      className="editor-content-area relative" 
      onMouseMove={handleMouseMove}
    >
      {controlsInfo && (
        <div 
          className="absolute left-2 flex items-start gap-1 transition-all duration-100 z-40"
          style={{ top: controlsInfo.top }}
        >
          <button className="p-1 hover:bg-white/5 rounded cursor-grab text-muted-foreground">
            <GripVertical size={14} />
          </button>
          
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={toggleMenu}
              className={cn(
                "p-1 rounded transition-colors",
                showComponentMenu ? "bg-accent text-accent-foreground" : "hover:bg-white/5 text-muted-foreground"
              )}
            >
              <Plus size={14} />
            </button>

            {showComponentMenu && (
              <div
                ref={menuRef}
                className={cn(
                  "absolute left-full ml-2 w-56 bg-panel border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-100 z-50",
                  menuPosition === 'top' ? "bottom-0" : "top-0"
                )}
              >
                <div className="p-2 text-[10px] font-bold text-accent-green uppercase tracking-wider border-bottom border-border">
                  Add Component
                </div>
                <div className="flex flex-col">
                  <MenuButton icon={<Type size={14}/>} label="Text" onClick={() => addComponent('text')} />
                  <MenuButton icon={<Heading1 size={14}/>} label="Heading 1" onClick={() => addComponent('h1')} />
                  <MenuButton icon={<Heading2 size={14}/>} label="Heading 2" onClick={() => addComponent('h2')} />
                  <MenuButton icon={<Code size={14}/>} label="Code Block" onClick={() => addComponent('code')} />
                  <MenuButton icon={<Quote size={14}/>} label="Quote" onClick={() => addComponent('quote')} />
                  <MenuButton icon={<List size={14}/>} label="Bullet List" onClick={() => addComponent('ul')} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent-green/10 hover:text-accent-green transition-colors"
    >
      <span className="opacity-70">{icon}</span>
      {label}
    </button>
  );
}