'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useConversations, useConversation } from '@/lib/swr';
import useSWR from 'swr';
import Button from '@/components/ui/Button';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ArrowLeftIcon,
  PlusIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  PencilIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { nl } from 'date-fns/locale';

function formatConversationTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Gisteren';
  return format(d, 'd MMM', { locale: nl });
}

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div className={cn('rounded-full bg-brand-500/15 text-brand-600 font-semibold flex items-center justify-center flex-shrink-0', sizes[size])}>
      {initials}
    </div>
  );
}

// ── New Conversation Modal ──
function NewConversationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const fetcher = (url: string) => fetch(url).then(r => r.json());
  const { data: users } = useSWR<any[]>('/api/conversations/users', fetcher);
  const { data: functies } = useSWR<any[]>('/api/functies', fetcher);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [activeFunctie, setActiveFunctie] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;

  const filtered = (users || []).filter(
    (e: any) =>
      e.id !== currentUserId &&
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      (!activeFunctie || (e.functies || []).some((f: any) => f.id === activeFunctie))
  );

  const isGroup = selectedIds.length > 1;

  async function handleCreate() {
    if (selectedIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: selectedIds,
          isGroup,
          name: isGroup ? groupName || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (data.id) onCreated(data.id);
    } catch (err) {
      console.error('Berichten action error:', err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Nieuw gesprek</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek medewerker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              autoFocus
            />
          </div>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedIds.map((id) => {
                const emp = (users || []).find((e: any) => e.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-600 rounded-full text-xs font-medium">
                    {emp?.name || id}
                    <button onClick={() => setSelectedIds(selectedIds.filter((i) => i !== id))} className="hover:text-brand-800">
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {isGroup && (
            <input
              type="text"
              placeholder="Groepsnaam (optioneel)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full mt-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          )}
        </div>

        {/* Functie filter chips */}
        {functies && functies.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveFunctie(null)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                !activeFunctie
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              )}
            >
              Iedereen
            </button>
            {functies.map((f: any) => (
              <button
                key={f.id}
                onClick={() => setActiveFunctie(activeFunctie === f.id ? null : f.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                  activeFunctie === f.id
                    ? 'text-white border-transparent'
                    : 'border-gray-200 hover:opacity-80'
                )}
                style={
                  activeFunctie === f.id
                    ? { backgroundColor: f.color, borderColor: f.color }
                    : { backgroundColor: f.color + '15', color: f.color, borderColor: f.color + '30' }
                }
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filtered.map((emp: any) => {
            const selected = selectedIds.includes(emp.id);
            return (
              <button
                key={emp.id}
                onClick={() =>
                  selected
                    ? setSelectedIds(selectedIds.filter((i) => i !== emp.id))
                    : setSelectedIds([...selectedIds, emp.id])
                }
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left',
                  selected && 'bg-brand-50/50'
                )}
              >
                <UserAvatar name={emp.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {emp.functies && emp.functies.length > 0 ? (
                      <span>{emp.functies.map((f: any) => <span key={f.id} style={{ color: f.color }}>{f.name}</span>).reduce((prev: any, curr: any) => [prev, ', ', curr])}</span>
                    ) : emp.email}
                  </p>
                </div>
                {selected && (
                  <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Geen medewerkers gevonden</p>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <Button onClick={handleCreate} disabled={selectedIds.length === 0 || creating} loading={creating} className="w-full">
            {isGroup ? 'Groepsgesprek starten' : 'Gesprek starten'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Conversation List ──
function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Berichten</h2>
        <button
          onClick={onNew}
          className="p-2 text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
          title="Nieuw gesprek"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="p-4 rounded-2xl bg-gray-50 mb-3">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Nog geen gesprekken</p>
            <p className="text-xs text-gray-400 mt-1">Start een nieuw gesprek via het + icoon</p>
          </div>
        ) : (
          conversations.map((conv: any) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50',
                activeId === conv.id && 'bg-brand-50/50'
              )}
            >
              {conv.isGroup ? (
                <div className="w-10 h-10 rounded-full bg-purple-500/15 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <UserGroupIcon className="h-5 w-5" />
                </div>
              ) : (
                <UserAvatar name={conv.name} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={cn('text-sm font-medium truncate', conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-600')}>
                    {conv.name}
                  </p>
                  {conv.lastMessage && (
                    <span className="text-[11px] text-gray-400 ml-2 flex-shrink-0">
                      {formatConversationTime(conv.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className={cn('text-xs truncate', conv.unreadCount > 0 ? 'text-gray-600 font-medium' : 'text-gray-400')}>
                    {conv.lastMessage
                      ? `${conv.lastMessage.senderId === currentUserId ? 'Jij: ' : ''}${conv.lastMessage.content}`
                      : 'Nog geen berichten'}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 flex-shrink-0 h-5 min-w-[20px] rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Group Settings Panel ──
function GroupSettingsPanel({
  conversation,
  onClose,
  onUpdated,
  onDeleted,
}: {
  conversation: any;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const fetcher = (url: string) => fetch(url).then((r) => r.json());
  const { data: allUsers } = useSWR<any[]>('/api/conversations/users', fetcher);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(conversation.name || '');
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const memberIds = conversation.members.map((m: any) => m.id);
  const availableUsers = (allUsers || []).filter(
    (u: any) => !memberIds.includes(u.id)
  );
  const filteredAvailable = availableUsers.filter((u: any) =>
    u.name.toLowerCase().includes(addSearch.toLowerCase())
  );

  async function handleRename() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      setEditingName(false);
      onUpdated();
    } catch (err) {
      console.error('Berichten action error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(userId: string) {
    setSaving(true);
    try {
      await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMemberIds: [userId] }),
      });
      onUpdated();
    } catch (err) {
      console.error('Berichten action error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setSaving(true);
    try {
      await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeMemberIds: [userId] }),
      });
      onUpdated();
    } catch (err) {
      console.error('Berichten action error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await fetch(`/api/conversations/${conversation.id}`, {
        method: 'DELETE',
      });
      onDeleted();
    } catch (err) {
      console.error('Berichten action error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Groepsinstellingen</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Group name */}
          <div className="p-4 border-b border-gray-100">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Groepsnaam</label>
            {editingName ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                />
                <button
                  onClick={handleRename}
                  disabled={saving || !name.trim()}
                  className="px-3 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  Opslaan
                </button>
                <button
                  onClick={() => { setEditingName(false); setName(conversation.name || ''); }}
                  className="px-3 py-2 text-gray-500 text-sm font-medium rounded-lg hover:bg-gray-100"
                >
                  Annuleer
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm font-medium text-gray-900">{conversation.name || 'Groepsgesprek'}</p>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Members */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Deelnemers ({conversation.members.length})
              </label>
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
              >
                <UserPlusIcon className="h-3.5 w-3.5" />
                Toevoegen
              </button>
            </div>

            {/* Add member search */}
            {showAddMember && (
              <div className="mb-3 p-3 bg-gray-50 rounded-xl">
                <div className="relative mb-2">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Zoek medewerker..."
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                    autoFocus
                  />
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Geen medewerkers beschikbaar</p>
                  ) : (
                    filteredAvailable.map((user: any) => (
                      <button
                        key={user.id}
                        onClick={() => handleAddMember(user.id)}
                        disabled={saving}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white rounded-lg transition-colors text-left"
                      >
                        <UserAvatar name={user.name} size="sm" />
                        <span className="text-sm text-gray-700 truncate">{user.name}</span>
                        <UserPlusIcon className="h-4 w-4 text-brand-500 ml-auto flex-shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Member list */}
            <div className="space-y-1">
              {conversation.members.map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
                  <UserAvatar name={member.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                    <p className="text-xs text-gray-400">
                      {member.id === conversation.createdBy ? 'Beheerder' : member.role === 'ADMIN' ? 'Administrator' : member.role === 'MANAGER' ? 'Manager' : 'Medewerker'}
                    </p>
                  </div>
                  {member.id !== conversation.createdBy && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={saving}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Verwijder uit groep"
                    >
                      <UserMinusIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Delete section */}
        <div className="p-4 border-t border-gray-100">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-red-600 font-medium">Weet je zeker dat je dit groepsgesprek wilt verwijderen? Alle berichten worden permanent verwijderd.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {saving ? 'Verwijderen...' : 'Ja, verwijderen'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-3 py-2 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 border border-gray-200"
                >
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 border border-red-200 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
              Groepsgesprek verwijderen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chat View ──
function ChatView({
  conversationId,
  onBack,
  onDeleted,
}: {
  conversationId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;
  const { data, mutate } = useConversation(conversationId);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversation = data?.conversation;
  const messages = data?.messages || [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;

    const content = message.trim();
    setMessage('');
    setSending(true);

    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      mutate();
    } catch {
      setMessage(content); // restore on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const otherMembers = (conversation?.members || []).filter((m: any) => m.id !== currentUserId);
  const chatName = conversation?.name || otherMembers.map((m: any) => m.name).join(', ');

  // Group messages by date
  let lastDate = '';

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="lg:hidden p-1 -ml-1 text-gray-400 hover:text-gray-600 rounded-lg">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        {conversation?.isGroup ? (
          <div className="w-9 h-9 rounded-full bg-purple-500/15 text-purple-600 flex items-center justify-center flex-shrink-0">
            <UserGroupIcon className="h-4 w-4" />
          </div>
        ) : (
          <UserAvatar name={chatName || '?'} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{chatName}</p>
          <p className="text-xs text-gray-400">
            {conversation?.isGroup
              ? `${conversation.members.length} deelnemers`
              : otherMembers[0]?.role === 'ADMIN'
                ? 'Administrator'
                : otherMembers[0]?.role === 'MANAGER'
                  ? 'Manager'
                  : 'Medewerker'}
          </p>
        </div>
        {conversation?.isGroup && conversation?.createdBy === currentUserId && (
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
            title="Groepsinstellingen"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ChatBubbleLeftRightIcon className="h-10 w-10 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Begin het gesprek!</p>
          </div>
        )}
        {messages.map((msg: any, i: number) => {
          const isOwn = msg.senderId === currentUserId;
          const msgDate = format(new Date(msg.createdAt), 'yyyy-MM-dd');
          let showDateDivider = false;
          if (msgDate !== lastDate) {
            lastDate = msgDate;
            showDateDivider = true;
          }

          const d = new Date(msg.createdAt);
          const dateLabel = isToday(d) ? 'Vandaag' : isYesterday(d) ? 'Gisteren' : format(d, 'd MMMM yyyy', { locale: nl });

          // Show sender name for group chats when it's not own message and different sender than previous
          const showSender = conversation?.isGroup && !isOwn && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-3 py-1 bg-gray-100 text-gray-400 text-[11px] font-medium rounded-full">
                    {dateLabel}
                  </span>
                </div>
              )}
              <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] sm:max-w-[70%]')}>
                  {showSender && (
                    <p className="text-[11px] text-gray-400 font-medium mb-0.5 ml-3">{msg.sender.name}</p>
                  )}
                  <div
                    className={cn(
                      'px-3.5 py-2 rounded-2xl text-sm leading-relaxed',
                      isOwn
                        ? 'bg-brand-500 text-white rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        isOwn ? 'text-white/60' : 'text-gray-300'
                      )}
                    >
                      {format(new Date(msg.createdAt), 'HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Typ een bericht..."
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className={cn(
            'p-2.5 rounded-full transition-all duration-200',
            message.trim()
              ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
              : 'bg-gray-100 text-gray-300'
          )}
        >
          <PaperAirplaneIcon className="h-4 w-4" />
        </button>
      </form>

      {/* Group settings panel */}
      {showSettings && conversation?.isGroup && (
        <GroupSettingsPanel
          conversation={conversation}
          onClose={() => setShowSettings(false)}
          onUpdated={() => { mutate(); setShowSettings(false); }}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}

// ── Main Page ──
export default function BerichtenPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: conversations, mutate: mutateConversations } = useConversations();
  const [activeConversation, setActiveConversation] = useState<string | null>(
    searchParams.get('conversation')
  );
  const [showNewModal, setShowNewModal] = useState(false);

  // Handle URL param
  useEffect(() => {
    const convId = searchParams.get('conversation');
    if (convId) setActiveConversation(convId);
  }, [searchParams]);

  function selectConversation(id: string) {
    setActiveConversation(id);
    router.replace(`/berichten?conversation=${id}`, { scroll: false });
  }

  function handleBack() {
    setActiveConversation(null);
    router.replace('/berichten', { scroll: false });
  }

  function handleDeleted() {
    setActiveConversation(null);
    router.replace('/berichten', { scroll: false });
    mutateConversations();
  }

  function handleCreated(id: string) {
    setShowNewModal(false);
    mutateConversations();
    selectConversation(id);
  }

  const convList = conversations || [];
  const totalUnread = convList.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);

  return (
    <div className="animate-fade-in">
      {/* Header — only visible when no conversation is active on mobile */}
      <div className={cn('mb-4', activeConversation && 'hidden lg:block')}>
        <h1 className="page-title">
          <span className="gradient-text">Berichten</span>
        </h1>
        <p className="page-subtitle">
          {totalUnread > 0
            ? `${totalUnread} ongelezen bericht${totalUnread !== 1 ? 'en' : ''}`
            : 'Communiceer met je team'}
        </p>
      </div>

      {/* Chat layout */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
        <div className="flex h-full">
          {/* Sidebar — conversation list */}
          <div
            className={cn(
              'w-full lg:w-80 lg:border-r border-gray-100 flex-shrink-0',
              activeConversation ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
            )}
          >
            <ConversationList
              conversations={convList}
              activeId={activeConversation}
              onSelect={selectConversation}
              onNew={() => setShowNewModal(true)}
            />
          </div>

          {/* Chat area */}
          <div className={cn('flex-1', !activeConversation ? 'hidden lg:flex' : 'flex')}>
            {activeConversation ? (
              <div className="flex-1 flex flex-col">
                <ChatView conversationId={activeConversation} onBack={handleBack} onDeleted={handleDeleted} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50/30">
                <div className="text-center">
                  <div className="p-4 rounded-2xl bg-gray-50 inline-block mb-3">
                    <ChatBubbleLeftRightIcon className="h-10 w-10 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">Selecteer een gesprek</p>
                  <p className="text-sm text-gray-400 mt-1">of start een nieuw gesprek</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New conversation modal */}
      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
