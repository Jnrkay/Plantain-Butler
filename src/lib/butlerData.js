// Butler's saved conversations (private to each person) and memories
// (shared 'household' facts + 'personal' ones only the author sees).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } },
}
export const CHAT_KEY = 'pb-chat-current'
export const CHAT_CACHE = 'pb-chat-cache'
const MEM_CACHE = 'pb-memories'

export const chatTitle = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t || 'New chat'
}

export function useButlerData(householdId, userId) {
  const [memories, setMemories] = useState(() => LS.get(MEM_CACHE, []))

  const loadMemories = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase.from('butler_memories').select('id,scope,fact,user_id,created_at')
      .eq('household_id', householdId).order('created_at')
    if (!error && data) { setMemories(data); LS.set(MEM_CACHE, data) }
  }, [householdId])
  useEffect(() => { loadMemories() }, [loadMemories])

  const addMemory = useCallback(async (fact, scope = 'household', chatId = null) => {
    const f = String(fact || '').trim().slice(0, 500)
    if (!f || !householdId) throw new Error('Nothing to remember')
    const row = { household_id: householdId, scope: scope === 'personal' ? 'personal' : 'household', fact: f, ...(chatId ? { chat_id: chatId } : {}) }
    const { data, error } = await supabase.from('butler_memories').insert(row).select('id,scope,fact,user_id,created_at').single()
    if (error) throw error
    setMemories((m) => { const next = [...m, data]; LS.set(MEM_CACHE, next); return next })
    return data
  }, [householdId])

  const removeMemory = useCallback(async (id) => {
    const { error } = await supabase.from('butler_memories').delete().eq('id', id)
    if (error) throw error
    setMemories((m) => { const next = m.filter((x) => x.id !== id); LS.set(MEM_CACHE, next); return next })
  }, [])

  const listChats = useCallback(async () => {
    if (!householdId) return []
    const { data, error } = await supabase.from('butler_chats').select('id,title,feed,updated_at,created_at')
      .eq('household_id', householdId).order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    return data || []
  }, [householdId])

  const loadChat = useCallback(async (id) => {
    const cached = LS.get(CHAT_CACHE, null)
    if (cached?.id === id) return cached
    const { data, error } = await supabase.from('butler_chats').select('id,title,messages,feed').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  }, [])

  // Create or update a conversation. Returns its id.
  const saveChat = useCallback(async ({ id, title, messages, feed }) => {
    if (!householdId) return id
    const row = { household_id: householdId, title: title || 'New chat', messages: messages.slice(-60), feed: feed.slice(-100) }
    if (id) {
      LS.set(CHAT_CACHE, { id, ...row })
      const { error } = await supabase.from('butler_chats').update(row).eq('id', id)
      if (error) throw error
      return id
    }
    const { data, error } = await supabase.from('butler_chats').insert(row).select('id').single()
    if (error) throw error
    LS.set(CHAT_CACHE, { id: data.id, ...row })
    return data.id
  }, [householdId])

  const deleteChat = useCallback(async (id) => {
    const { error } = await supabase.from('butler_chats').delete().eq('id', id)
    if (error) throw error
    if (LS.get(CHAT_CACHE, null)?.id === id) LS.set(CHAT_CACHE, null)
  }, [])

  // Look through past conversations for something said before
  const searchChats = useCallback(async (query) => {
    const q = String(query || '').toLowerCase().trim()
    const chats = await listChats()
    const hits = []
    chats.forEach((c) => {
      ;(c.feed || []).forEach((m) => {
        if ((m.kind === 'user' || m.kind === 'butler' || m.kind === 'action') && (!q || String(m.text).toLowerCase().includes(q))) {
          hits.push({ date: String(c.updated_at).slice(0, 10), title: c.title, who: m.kind === 'user' ? 'User' : 'Butler', text: String(m.text).slice(0, 300) })
        }
      })
    })
    return hits.slice(0, 25)
  }, [listChats])

  return { memories, userId, loadMemories, addMemory, removeMemory, listChats, loadChat, saveChat, deleteChat, searchChats }
}
