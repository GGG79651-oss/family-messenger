import { useState, useEffect, useRef } from 'react'
import { auth, db } from '../../firebase/config'
import { signOut } from 'firebase/auth'
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, setDoc, serverTimestamp,
  addDoc, updateDoc, where, getDocs
} from 'firebase/firestore'
import Message from './Message'
import MessageInput from './MessageInput'
import VideoCall from '../VideoCall/VideoCall'
import './ChatRoom.css'

const CHAT_ID = 'family-chat'

export default function ChatRoom({ user }) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [showMembers, setShowMembers] = useState(false)
  const [activeCall, setActiveCall] = useState(null) // { callId, isIncoming, callerName }
  const [incomingCall, setIncomingCall] = useState(null)
  const messagesEndRef = useRef(null)
  const prevMsgCount = useRef(0)

  // Обновляем статус онлайн
  useEffect(() => {
    const userRef = doc(db, 'users', user.uid)
    setDoc(userRef, {
      name: user.displayName || 'Пользователь',
      email: user.email,
      uid: user.uid,
      online: true,
      lastSeen: serverTimestamp()
    }, { merge: true })

    const interval = setInterval(() => {
      setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true })
    }, 30000)

    const handleUnload = () => {
      setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true })
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
      setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true })
    }
  }, [user])

  // Загружаем сообщения
  useEffect(() => {
    const q = query(
      collection(db, 'chats', CHAT_ID, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    )
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMessages(msgs)
    })
    return unsub
  }, [])

  // Загружаем список участников
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => d.data()))
    })
    return unsub
  }, [])

  // Слушаем входящие звонки
  useEffect(() => {
    const q = query(
      collection(db, 'calls'),
      where('ended', '==', false)
    )
    const unsub = onSnapshot(q, snap => {
      snap.docChanges().forEach(change => {
        const data = change.doc.data()
        if (change.type === 'added' && data.callerId !== user.uid) {
          setIncomingCall({
            callId: change.doc.id,
            callerName: data.callerName
          })
        }
        if (change.type === 'modified' && data.ended) {
          setIncomingCall(null)
        }
        if (change.type === 'removed') {
          setIncomingCall(null)
        }
      })
    })
    return unsub
  }, [user])

  // Прокрутка вниз при новом сообщении
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMsgCount.current = messages.length
  }, [messages])

  const startCall = async (targetUser) => {
    setShowMembers(false)
    const callRef = doc(collection(db, 'calls'))
    setActiveCall({
      callId: callRef.id,
      isIncoming: false,
      callerName: targetUser.name
    })
  }

  const acceptCall = () => {
    if (!incomingCall) return
    setActiveCall({ ...incomingCall, isIncoming: true })
    setIncomingCall(null)
  }

  const rejectCall = async () => {
    if (!incomingCall) return
    try {
      await updateDoc(doc(db, 'calls', incomingCall.callId), { ended: true })
    } catch {}
    setIncomingCall(null)
  }

  const handleSignOut = async () => {
    await setDoc(doc(db, 'users', user.uid), { online: false }, { merge: true })
    await signOut(auth)
  }

  const onlineCount = members.filter(m => m.online).length

  return (
    <div className="chatroom">
      {/* Заголовок */}
      <header className="chat-header">
        <div className="chat-header-left">
          <div className="chat-title">
            <span className="chat-name">🏠 Семья</span>
            <span className="chat-online">{onlineCount} онлайн</span>
          </div>
        </div>
        <div className="chat-header-right">
          <button
            className="header-btn"
            onClick={() => setShowMembers(v => !v)}
            title="Участники"
          >
            👥
          </button>
          <button
            className="header-btn"
            onClick={handleSignOut}
            title="Выйти"
          >
            🚪
          </button>
        </div>
      </header>

      {/* Список участников */}
      {showMembers && (
        <div className="members-panel">
          <div className="members-title">Участники ({members.length})</div>
          {members.map(m => (
            <div key={m.uid} className="member-row">
              <div className="member-status-dot" style={{ background: m.online ? '#4ade80' : '#555' }} />
              <span className="member-name">{m.name}</span>
              {m.uid !== user.uid && (
                <button className="call-member-btn" onClick={() => startCall(m)}>
                  📞
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Сообщения */}
      <div className="messages-list">
        {messages.length === 0 && (
          <div className="empty-chat">
            <span>👋</span>
            <p>Напишите первое сообщение!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.senderId === user.uid
          const prevMsg = messages[i - 1]
          const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId
          return (
            <Message
              key={msg.id}
              msg={msg}
              isOwn={isOwn}
              showAvatar={showAvatar}
            />
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Ввод сообщения */}
      <MessageInput user={user} />

      {/* Входящий звонок */}
      {incomingCall && (
        <div className="incoming-call-banner">
          <div className="incoming-call-info">
            <span className="incoming-call-icon">📞</span>
            <div>
              <div className="incoming-caller">{incomingCall.callerName}</div>
              <div className="incoming-label">Входящий видеозвонок</div>
            </div>
          </div>
          <div className="incoming-call-btns">
            <button className="accept-btn" onClick={acceptCall}>✅</button>
            <button className="reject-btn" onClick={rejectCall}>❌</button>
          </div>
        </div>
      )}

      {/* Активный звонок */}
      {activeCall && (
        <VideoCall
          callId={activeCall.callId}
          isIncoming={activeCall.isIncoming}
          callerName={activeCall.callerName}
          user={user}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </div>
  )
}
