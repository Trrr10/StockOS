import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Pin, AtSign, Loader, MessageSquare, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const GROUP = 'inventory'

export default function GroupChatPage() {
  const { user, profile }     = useAuth()
  const [messages, setMessages] = useState([])
  const [members, setMembers]   = useState([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [loading, setLoading]   = useState(true)
  const [showMentions, setShowMentions] = useState(false)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  useEffect(() => {
    loadMessages()
    loadMembers()

    const sub = supabase.channel(`chat-${GROUP}`)
      .on('postgres_changes', {
        event:'INSERT', schema:'public', table:'chat_messages',
        filter:`group_name=eq.${GROUP}`,
      }, async (payload) => {
        // Fetch with profile join
        const { data } = await supabase
          .from('chat_messages')
          .select('*, profiles(id, full_name, role)')
          .eq('id', payload.new.id)
          .single()
        if (data) setMessages(prev => [...prev, data])
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles(id, full_name, role)')
      .eq('group_name', GROUP)
      .order('created_at', { ascending: true })
      .limit(80)
    if (data) setMessages(data)
    setLoading(false)
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['inventory_manager','admin'])
      .eq('is_active', true)
    if (data) setMembers(data)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    const { error } = await supabase.from('chat_messages').insert({
      group_name: GROUP,
      sender_id: user.id,
      content: text,
    })
    if (error) { toast.error('Failed to send'); setInput(text) }
    setSending(false)
  }

  async function pinMessage(id, pinned) {
    if (!profile?.is_group_leader) return
    await supabase.from('chat_messages').update({ is_pinned: !pinned }).eq('id', id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_pinned: !pinned } : m))
  }

  const pinnedMessages = messages.filter(m => m.is_pinned)

  const initials = (name) => name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const roleColor = (role) => ({
    admin:'#a78bfa', inventory_manager:'#7effd4', sales:'#60a5fa', procurement:'#fb923c'
  })[role] || '#7effd4'

  return (
    <div className="flex gap-5" style={{ height:'calc(100vh - 112px)' }}>
      {/* ── Chat ── */}
      <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:'rgba(126,255,212,0.1)', border:'1px solid rgba(126,255,212,0.2)' }}>
            <MessageSquare size={15} style={{ color:'#7effd4' }} />
          </div>
          <div>
            <div className="font-display font-semibold text-white text-sm">Inventory Group Chat</div>
            <div className="text-xs text-muted">{members.length} members · Real-time via Supabase</div>
          </div>
          <motion.div animate={{ opacity:[1,0.4,1] }} transition={{ duration:2, repeat:Infinity }}
            className="ml-auto w-2 h-2 rounded-full bg-green-400" />
        </div>

        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div className="px-4 py-2.5 border-b border-border"
            style={{ background:'rgba(126,255,212,0.03)' }}>
            {pinnedMessages.slice(0,2).map(m => (
              <div key={m.id} className="flex items-start gap-2 text-xs">
                <Pin size={10} style={{ color:'#7effd4', flexShrink:0, marginTop:2 }} />
                <span className="text-white/60 truncate">{m.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted text-sm">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted gap-3">
              <MessageSquare size={36} className="opacity-20" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id
              const color = roleColor(msg.profiles?.role)
              const showAvatar = i === 0 || messages[i-1].sender_id !== msg.sender_id
              const showName   = showAvatar

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity:0, y:6 }}
                  animate={{ opacity:1, y:0 }}
                  className={`flex items-end gap-2.5 group ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div style={{ width:28, flexShrink:0 }}>
                    {showAvatar && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background:`${color}18`, border:`1px solid ${color}30`, color }}>
                        {initials(msg.profiles?.full_name || '?')}
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {showName && !isMe && (
                      <span className="text-xs font-medium px-1" style={{ color }}>
                        {msg.profiles?.full_name || 'Unknown'}
                      </span>
                    )}
                    <div className="flex items-end gap-2 group/msg">
                      {msg.is_pinned && (
                        <Pin size={9} style={{ color:'#7effd4', marginBottom:4, flexShrink:0 }} />
                      )}
                      <div
                        className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={isMe
                          ? { background:'#7effd4', color:'#07080f', fontWeight:500, borderBottomRightRadius:4 }
                          : { background:'rgba(255,255,255,0.06)', border:'1px solid var(--border)', color:'#e2e8f0', borderBottomLeftRadius:4 }}
                      >
                        {msg.content}
                      </div>
                      {/* Pin button (group leader only) */}
                      {profile?.is_group_leader && (
                        <button
                          onClick={() => pinMessage(msg.id, msg.is_pinned)}
                          className="opacity-0 group-hover/msg:opacity-100 transition-opacity text-muted hover:text-accent"
                        >
                          <Pin size={11} />
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-muted/50 font-mono px-1">
                      {format(new Date(msg.created_at), 'HH:mm')}
                    </span>
                  </div>
                </motion.div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <div className="flex items-end gap-2">
            {/* Mention button */}
            <div className="relative">
              <motion.button
                whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }}
                onClick={() => setShowMentions(s => !s)}
                className="w-9 h-9 rounded-xl btn-ghost flex items-center justify-center flex-shrink-0"
              >
                <AtSign size={14} />
              </motion.button>
              <AnimatePresence>
                {showMentions && (
                  <motion.div
                    initial={{ opacity:0, y:8, scale:0.95 }}
                    animate={{ opacity:1, y:0, scale:1 }}
                    exit={{ opacity:0, y:4, scale:0.95 }}
                    className="absolute bottom-12 left-0 w-48 rounded-xl overflow-hidden shadow-xl z-10"
                    style={{ background:'#12131f', border:'1px solid var(--border)' }}
                  >
                    {members.map(m => (
                      <button key={m.id}
                        onClick={() => {
                          setInput(i => i + `@${m.full_name.split(' ')[0]} `)
                          setShowMentions(false)
                          inputRef.current?.focus()
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background:`${roleColor(m.role)}18`, color:roleColor(m.role) }}>
                          {initials(m.full_name)}
                        </div>
                        <span className="text-xs text-white">{m.full_name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <textarea
              ref={inputRef}
              className="input-dark flex-1 rounded-xl px-4 py-2.5 text-sm resize-none"
              style={{ minHeight:'42px', maxHeight:'100px' }}
              placeholder="Send a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              rows={1}
            />

            <motion.button
              whileHover={{ scale:1.07 }} whileTap={{ scale:0.93 }}
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            >
              {sending
                ? <motion.div animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity }}><Loader size={14} /></motion.div>
                : <Send size={14} />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Members sidebar ── */}
      <div className="w-52 glass-card rounded-2xl p-4 hidden lg:block" style={{ height:'fit-content' }}>
        <div className="flex items-center gap-2 mb-4">
          <Users size={14} style={{ color:'#7effd4' }} />
          <h3 className="font-display font-semibold text-white text-sm">Members ({members.length})</h3>
        </div>
        <div className="space-y-2.5">
          {members.map((m, i) => (
            <motion.div key={m.id}
              initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background:`${roleColor(m.role)}18`, color:roleColor(m.role) }}>
                {initials(m.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{m.full_name}</div>
                <div className="text-[10px] text-muted capitalize">{m.role?.replace('_',' ')}</div>
              </div>
              <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:3, repeat:Infinity, delay: i * 0.5 }}
                className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}